import { Container } from "inversify";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import TYPES from "../Types";
import { AdminVersionDetector } from "../services/adminVersionDetector/AdminVersionDetector";
import { IAdminVersionDetector } from "../services/adminVersionDetector/IAdminVersionDetector";
import { ConnectionServiceAdmin4 } from "../services/connection/ConnectionServiceAdmin4";
import { ConnectionServiceAdmin5 } from "../services/connection/ConnectionServiceAdmin5";
import { ConnectionServiceProvider } from "../services/connectionServiceProvider/ConnectionServiceProvider";
import { IConnectionServiceProvider } from "../services/connectionServiceProvider/IConnectionServiceProvider";
import { IConfigRepositoryService } from "../services/configRepository/IConfigRepositoryService";
import { DirectoryService } from "../services/directory/DirectorytService";
import { IDirectoryService } from "../services/directory/IDirectoryService";
import { IJsInstanceService } from "../services/jsInstanceService/IJsInstanceService";
import { JsInstanceService } from "../services/jsInstanceService/JsInstanceService";
import { ILoginCredentialsService } from "../services/loginCredentialsService/ILoginCredentialsService";
import { ILoginService } from "../services/loginHttpClient/ILoginService";
import { LoginService } from "../services/loginHttpClient/LoginService";
import { SecretPlaceholderService } from "../services/scriptRemote/SecretPlaceholderService";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { ScriptRemoteService } from "../services/scriptRemote/ScriptRemoteService";
import { SocketIoClient } from "../services/socketIoClient/SocketIoClient";
import { ISocketIoClient } from "../services/socketIoClient/ISocketIoClient";
import { IStateAndObjectRemoteService } from "../services/stateRemote/IStateAndObjectRemoteService";
import { StateAndObjectRemoteService } from "../services/stateRemote/StateAndObjectRemoteService";
import { IStatusBarService } from "../services/statusBar/IStatusBarService";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { EnvConfigRepositoryService } from "../services/remote/EnvConfigRepositoryService";
import { EnvLoginCredentialsService } from "../services/remote/EnvLoginCredentialsService";
import { NoStatusBarService } from "../services/remote/NoStatusBarService";
import { NoWorkspaceService } from "../services/remote/NoWorkspaceService";
import { RemoteConnectionService } from "../services/remote/RemoteConnectionService";
import { HostLogService } from "../services/log/HostLogService";
import { RemoteScriptIdService } from "../services/remote/RemoteScriptIdService";
import { RemoteScriptRepository } from "../services/remote/RemoteScriptRepository";
import { StderrDebugLogService } from "../services/remote/StderrDebugLogService";
import type { RemoteToolDeps } from "../aiTools/core/remote/types";
import type { Logger } from "./Logger";
import type { ServerConfig } from "./ServerConfig";
import { ToolResultMapper } from "./ToolResultMapper";
import { BUILD_VERSION } from "./version";
import { getRemoteToolHandler, isReadOnlyTool, isRemoteToolName, listRemoteTools } from "./tools/remoteToolSet";

/** Section 10.4: the whole tool call, the cap and the read-only contract. */
export const TOOL_CALL_BUDGET_MS = 30 * 1000;
export const MAX_CONCURRENT_CALLS = 8;

const INSTRUCTIONS =
    "ioBroker script ids look like 'script.js.common.MyScript'. Use iobroker_get_scripts first to look up " +
    "script and directory ids. Read a script with iobroker_get_script_content before editing it, then write the " +
    "complete source with iobroker_update_script_source.";

class ToolCallTimeoutError extends Error {
    constructor() {
        super(`The tool call did not finish within ${TOOL_CALL_BUDGET_MS / 1000} seconds.`);
        this.name = "ToolCallTimeoutError";
    }
}

/**
 * Wires the services, registers the two handlers and owns the lifecycle of the stdio transport.
 * The process lives and dies with its client: stdin close, SIGINT and SIGTERM are the shutdown
 * triggers.
 */
export class McpServerRunner {
    private activeCalls = 0;
    private shuttingDown = false;
    private resolveClosed: (() => void) | undefined;
    private readonly closed: Promise<void>;
    private readonly resultMapper: ToolResultMapper;

    private constructor(
        private readonly config: ServerConfig,
        private readonly logger: Logger,
        private readonly connection: RemoteConnectionService,
        private readonly repository: RemoteScriptRepository,
        private readonly deps: RemoteToolDeps,
        private readonly server: Server
    ) {
        this.resultMapper = new ToolResultMapper(logger);
        this.closed = new Promise<void>(resolve => {
            this.resolveClosed = resolve;
        });
    }

    static create(config: ServerConfig, logger: Logger): McpServerRunner {
        const container = createContainer(config, logger);
        const configRepository = container.get<EnvConfigRepositoryService>(TYPES.services.configRepository);
        const connectionProvider = container.get<IConnectionServiceProvider>(TYPES.services.connectionServiceProvider);
        const loginService = container.get<ILoginService>(TYPES.services.login);
        const credentials = container.get<ILoginCredentialsService>(TYPES.services.loginCredentials);
        const adminVersionDetector = container.get<IAdminVersionDetector>(TYPES.services.adminVersionDetector);
        const scriptRemote = container.get<IScriptRemoteService>(TYPES.services.scriptRemote);
        const directories = container.get<IDirectoryService>(TYPES.services.directory);
        const jsInstances = container.get<IJsInstanceService>(TYPES.services.jsInstance);
        const states = container.get<IStateAndObjectRemoteService>(TYPES.services.stateAndObjectRemoteService);

        const repository = new RemoteScriptRepository({ scriptRemote: scriptRemote, directories: directories });
        repository.init();

        const connection = new RemoteConnectionService(
            configRepository,
            adminVersionDetector,
            connectionProvider,
            loginService,
            credentials,
            logger,
            {
                url: config.url,
                username: config.username,
                allowSelfSignedCertificate: config.allowSelfSignedCertificate
            });

        // After the first connect the admin version is known, so the socket subscriptions can
        // start. `onReady` fires again on every reconnect; subscribing twice would duplicate the
        // object change handlers, so the init runs once.
        let socketSubscriptionsStarted = false;
        connection.onReady(() => {
            if (socketSubscriptionsStarted) {
                return;
            }

            socketSubscriptionsStarted = true;
            scriptRemote.init();
        });

        const deps: RemoteToolDeps = {
            connection: connection,
            scripts: repository,
            scriptRemote: scriptRemote,
            directories: directories,
            jsInstances: jsInstances,
            states: states,
            logs: new HostLogService(connectionProvider)
        };

        const server = new Server(
            { name: "iobroker-mcp", version: BUILD_VERSION },
            { capabilities: { tools: {} }, instructions: INSTRUCTIONS });

        const runner = new McpServerRunner(config, logger, connection, repository, deps, server);
        runner.registerHandlers();

        return runner;
    }

    /** Starts serving and resolves when the client closed the connection. */
    async run(): Promise<void> {
        const transport = new StdioServerTransport();

        process.stdin.on("end", () => void this.shutdown(0));
        process.stdin.on("close", () => void this.shutdown(0));
        process.on("SIGINT", () => void this.shutdown(0));
        process.on("SIGTERM", () => void this.shutdown(0));
        // A client that closes the pipe must not produce an unhandled error; it is a normal shutdown.
        process.stdout.on("error", error => {
            if ((error as NodeJS.ErrnoException).code === "EPIPE") {
                void this.shutdown(0);
                return;
            }

            this.logger.error(`stdout error: ${error.message}`);
        });

        this.logger.info(`iobroker-mcp ${BUILD_VERSION} started. ${this.config.toLogString()}`);
        if (this.config.allowSelfSignedCertificate && this.config.url.startsWith("http://")) {
            this.logger.warn("IOBROKER_MCP_ALLOW_SELF_SIGNED is ignored for an http:// URL.");
        }

        await this.server.connect(transport);
        await this.closed;
    }

    private registerHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: listRemoteTools(this.config.readOnly)
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async request => {
            return this.callTool(request.params.name, request.params.arguments ?? {});
        });
    }

    private async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        // A name outside the advertised list is a protocol error, not a tool result: a model that
        // hallucinated it should see a hard failure instead of a plausible-looking answer.
        if (!isRemoteToolName(name)) {
            throw new McpError(ErrorCode.InvalidParams, `Unknown tool '${name}'.`);
        }

        if (this.config.readOnly && !isReadOnlyTool(name)) {
            throw new McpError(ErrorCode.InvalidParams, `The tool '${name}' is not available in read-only mode.`);
        }

        if (this.activeCalls >= MAX_CONCURRENT_CALLS) {
            return this.resultMapper.toErrorResult("server_error", `Too many concurrent calls, the limit is ${MAX_CONCURRENT_CALLS}. Retry when a running call has finished.`);
        }

        this.activeCalls++;
        const started = Date.now();

        try {
            const handler = getRemoteToolHandler(name);

            // Validate first, connect lazily: a malformed call must fail with `invalid_input` even
            // when ioBroker is not reachable. Every tool answers `not_connected` when it needs the
            // connection, which triggers the second attempt below.
            if (this.connection.isConnected()) {
                // The first load downloads all scripts and directories, so it has to share the
                // budget: a lost socket acknowledgement would otherwise hang the call forever.
                await withToolBudget(this.repository.ensureLoaded());
            }

            let outcome = await withToolBudget(handler(this.deps, args));

            if (!outcome.ok && outcome.error.code === "not_connected") {
                try {
                    await this.connection.ensureConnected();
                } catch (error) {
                    const hint = error instanceof Error && "hint" in error ? `${(error as { hint?: string }).hint ?? ""}` : undefined;
                    return this.resultMapper.toErrorResult("not_connected", messageOf(error), hint || undefined);
                }

                await withToolBudget(this.repository.ensureLoaded());
                outcome = await withToolBudget(handler(this.deps, args));
            }

            // Do not log tool payloads: script sources and state values can contain secrets.
            this.logger.debug(`${name} finished in ${Date.now() - started} ms.`);

            return this.resultMapper.toResult(outcome);
        } catch (error) {
            this.logger.error(`${name} failed: ${messageOf(error)}`);

            if (error instanceof ToolCallTimeoutError) {
                return this.resultMapper.toErrorResult("server_error", error.message, "Narrow the request, for example by using a smaller limit or a shorter time range.");
            }

            return this.resultMapper.toErrorResult("server_error", messageOf(error), "Check the ioBroker connection and the given arguments, then retry.");
        } finally {
            this.activeCalls--;
        }
    }

    private async shutdown(exitCode: number): Promise<void> {
        if (this.shuttingDown) {
            return;
        }

        this.shuttingDown = true;
        this.logger.info("Shutting down.");

        const forceExit = setTimeout(() => {
            process.exit(exitCode);
        }, 5000);
        forceExit.unref();

        try {
            await this.connection.stop();
            await this.server.close();
        } catch (error) {
            this.logger.debug(`Shutdown error: ${messageOf(error)}`);
        }

        this.resolveClosed?.();
    }
}

function createContainer(config: ServerConfig, logger: Logger): Container {
    const container = new Container();

    // The seams that replace VS Code bound services.
    container.bind(TYPES.services.debugLogService).toConstantValue(new StderrDebugLogService(logger));
    container.bind<IStatusBarService>(TYPES.services.statusBarService).toConstantValue(new NoStatusBarService());
    container.bind<IWorkspaceService>(TYPES.services.workspace).toConstantValue(new NoWorkspaceService());
    container.bind(TYPES.services.scriptId).toConstantValue(new RemoteScriptIdService());
    container.bind(TYPES.services.loginCredentials).toConstantValue(new EnvLoginCredentialsService(config.password));

    const configRepository = new EnvConfigRepositoryService({
        ioBrokerUrl: config.url,
        socketIoPort: config.socketIoPort,
        username: config.username,
        allowSelfSignedCertificate: config.allowSelfSignedCertificate,
        scriptAutoRun: config.scriptAutoRun
    });
    container.bind<IConfigRepositoryService>(TYPES.services.configRepository).toConstantValue(configRepository);

    container.bind<ISocketIoClient>(TYPES.services.socketIoClient).to(SocketIoClient).inSingletonScope();
    container.bind(TYPES.services.connectionAdmin4).to(ConnectionServiceAdmin4).inSingletonScope();
    container.bind(TYPES.services.connectionAdmin5).to(ConnectionServiceAdmin5).inSingletonScope();
    container.bind<IConnectionServiceProvider>(TYPES.services.connectionServiceProvider).to(ConnectionServiceProvider).inSingletonScope();
    container.bind<IAdminVersionDetector>(TYPES.services.adminVersionDetector).to(AdminVersionDetector).inSingletonScope();
    container.bind<ILoginService>(TYPES.services.login).to(LoginService).inSingletonScope();
    container.bind(TYPES.services.directory).to(DirectoryService).inSingletonScope();
    container.bind(TYPES.services.secretPlaceholder).to(SecretPlaceholderService).inSingletonScope();
    container.bind<IScriptRemoteService>(TYPES.services.scriptRemote).to(ScriptRemoteService).inSingletonScope();
    container.bind<IStateAndObjectRemoteService>(TYPES.services.stateAndObjectRemoteService).to(StateAndObjectRemoteService).inSingletonScope();
    container.bind<IJsInstanceService>(TYPES.services.jsInstance).to(JsInstanceService).inSingletonScope();

    return container;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : `${error}`;
}

function withToolBudget<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new ToolCallTimeoutError()), TOOL_CALL_BUDGET_MS);

        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}
