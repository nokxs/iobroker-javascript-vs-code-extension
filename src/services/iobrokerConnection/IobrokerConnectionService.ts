import { env, Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import { AdminVersion, Config, NoConfig } from '../../models/Config';
import { NoWorkspaceFolder } from '../../models/NoWorkspaceFolder';
import TYPES from '../../Types';
import { ILogService } from '../log/ILogService';
import { IWorkspaceService } from '../workspace/IWorkspaceService';
import { IIobrokerConnectionService } from "./IIobrokerConnectionService";
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IConfigCreationService } from "../configCreation/IConfigCreationService";
import { IScriptService } from "../script/IScriptService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { ILoginService } from "../loginHttpClient/ILoginService";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { IStatusBarService } from "../statusBar/IStatusBarService";
import { IWindowMessageService } from "../windowMessage/IWindowMessageService";
import { IObjectRepositoryService } from "../StateRepository/IObjectRepositoryService";
import { IStateAndObjectRemoteService } from "../stateRemote/IStateAndObjectRemoteService";
import { IAutoUploadService } from "../autoUpload/IAutoUploadService";
import { LoginType } from "../loginHttpClient/LoginType";
import { formatError } from "../formatError";
import { resolveConnectionTimeouts } from "../socketIoClient/ConnectionTimeouts";
import { ConnectionStatusPresenter } from "./ConnectionStatusPresenter";

@injectable()
export class IobrokerConnectionService implements IIobrokerConnectionService, IConnectionEventListener {

    config: Config = new NoConfig();

    private isReAuthenticationRunning = false;
    private isFullConnectRunning = false;
    private isInitializing = false;
    private isInitialized = false;
    private isAutoUploadInitialized = false;
    private isObjectIndexStale = false;
    private connectPromise: Promise<void> | undefined;
    private reloadPromise: Promise<void> | undefined;
    private backgroundInitPromise: Promise<void> | undefined;
    private presenter: ConnectionStatusPresenter;

    /** Login type which was detected during a regular connect. Needed to re-authenticate without asking the user. */
    private detectedLoginType: { ioBrokerUrl: string; loginType: LoginType } | undefined = undefined;

    constructor(
        @inject(TYPES.services.configCreation) private configCreationService: IConfigCreationService,
        @inject(TYPES.services.configRepository) private configRepository: IConfigRepositoryService,
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.log) private logService: ILogService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.login) private loginService: ILoginService,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,
        @inject(TYPES.services.statusBarService) private statusBarService: IStatusBarService,
        @inject(TYPES.services.windowMessageService) private windowMessageService: IWindowMessageService,
        @inject(TYPES.services.objectRepositoryService) private objectRepositoryService: IObjectRepositoryService,
        @inject(TYPES.services.stateAndObjectRemoteService) private stateAndObjectRemoteService: IStateAndObjectRemoteService,
        @inject(TYPES.services.autoUploadService) private autoUploadService: IAutoUploadService
    ) {
        statusBarService.init();
        this.presenter = new ConnectionStatusPresenter(statusBarService);
        this.presenter.set("disconnected");
    }

    onConnected(reconnectAttempts?: number): void {
        if (this.isFullConnectRunning || this.isInitializing) {
            // The running connect initializes (or reloads) everything itself.
            return;
        }

        if (!this.isInitialized) {
            // The initial connect timed out, but the background reconnect succeeded later.
            this.logDebug("Connection established by auto reconnect. Initializing extension...");
            this.backgroundInitPromise = this.runInitialization(false).finally(() => {
                this.backgroundInitPromise = undefined;
            });
            return;
        }

        if (reconnectAttempts !== undefined) {
            this.logDebug(`Connection restored after ${reconnectAttempts} reconnect attempt(s)`);
        }
        // The script list was cleared when the connection was lost and has to be loaded again.
        void this.reloadScripts(`reconnect after ${reconnectAttempts ?? 0} attempt(s)`);
    }

    onDisconnected(): void {
        this.presenter.set("disconnected");
    }

    onConnectionLost(reason: string): void {
        this.logDebug(`Connection lost: ${reason}`);
    }

    onReconnecting(attempt: number, delayMs: number): void {
        this.presenter.setReconnecting(attempt, delayMs);
    }

    async onReAuthenticate(): Promise<void> {
        this.debugLogService.log("start reAuthentication", "IobrokerConnectionService");

        if (!this.isReAuthenticationRunning) {
            this.debugLogService.log("reAuthentication not running", "IobrokerConnectionService");
            this.isReAuthenticationRunning = true;
            this.statusBarService.setText("$(warning) ioBroker disconnected (authentication required)");
            try {
                // The password from the storage is reused here. The login service only asks the user for
                // a new one, if logging in with the stored password fails.
                await this.connect(true); // force login
            }
            finally {
                this.isReAuthenticationRunning = false;
                this.debugLogService.log("reAuthentication done", "IobrokerConnectionService");
            }
        }
    }

    isConnected(): boolean {
        return this.connectionServiceProvider.isConnectionServiceAvailable() && this.connectionServiceProvider.getConnectionService().isConnected;
    }

    /** Single flight: a connect request while another one is running joins the running one. */
    connect(forceLogin: boolean = false): Promise<void> {
        if (this.connectPromise) {
            this.logDebug("Connect already running. Joining it.");
            return this.connectPromise;
        }

        this.connectPromise = this.connectOnce(forceLogin).finally(() => {
            this.connectPromise = undefined;
        });
        return this.connectPromise;
    }

    async rebuildObjectIndex(): Promise<void> {
        if (!this.isInitialized || !this.isConnected()) {
            this.windowMessageService.showWarning("ioBroker: Not connected. Connect first, then rebuild the object index.");
            return;
        }
        await this.loadObjectIndex(true);
    }

    private async connectOnce(forceLogin: boolean): Promise<void> {
        if (this.backgroundInitPromise) {
            // A new connect would close the socket the initialization is using.
            this.logDebug("Initialization after auto reconnect running. Waiting for it.");
            await this.backgroundInitPromise;
            if (!forceLogin && this.isInitialized) {
                return;
            }
        }

        if (!forceLogin && this.isInitialized && this.isConnected()) {
            if (!await this.hasConnectionConfigChanged()) {
                // Already connected: a full connect would only reload everything, so refresh the scripts.
                await this.reloadScripts("connect while connected");
                return;
            }
            this.logDebug("Connection settings changed. Connecting with the new settings...");
            this.isObjectIndexStale = true;
        }

        if (!forceLogin && await this.tryRestoreSession()) {
            return;
        }

        await this.fullConnect(forceLogin);
    }

    private async fullConnect(forceLogin: boolean): Promise<void> {
        this.isFullConnectRunning = true;
        this.presenter.set("connecting");
        try {
            const isInitialConnect = await this.establishConnection(forceLogin);
            if (isInitialConnect === undefined) {
                if (!this.isConnected() && this.presenter.current === "connecting") {
                    this.presenter.set("disconnected");
                }
                return;
            }
            await this.runInitialization(isInitialConnect);
        } finally {
            this.isFullConnectRunning = false;
        }
    }

    /** @returns whether this is the initial connect (new config), or undefined if no connection was established. */
    private async establishConnection(forceLogin: boolean): Promise<boolean | undefined> {
        try {
            let isInitialConnect = false;
            let workspaceFolder = await this.workspaceService.getWorkspaceToUse();

            if (workspaceFolder instanceof NoWorkspaceFolder) {
                this.windowMessageService.showError("Cannot continue execution of extension 'ioBroker.javascript', because no valid workspace was selected. Exiting.");
                return;
            }

            this.config = await this.configRepository.read(workspaceFolder);
            this.logDebug(`read config: ${JSON.stringify(this.config)}`);

            if (!(this.config instanceof NoConfig) && !this.isConfigValid()) {
                this.logDebug("Config is invalid");
                const pickAnswer = await window.showQuickPick(["Yes", "No", "No, open documentation"], { placeHolder: "ioBroker: Your config is missing mandatory items. Recreate config?", ignoreFocusOut: true });
                if (pickAnswer === "Yes") {
                    this.logDebug("Config shall be recreated");
                    this.config = new NoConfig();
                }
                else if (pickAnswer === "No, open documentation") {
                    await env.openExternal(Uri.parse("https://github.com/nokxs/iobroker-javascript-vs-code-extension#available-settings"));
                    this.windowMessageService.showWarning("Connection attempt to ioBroker aborted. Update your config and try again!");
                    this.logDebug("Abort connection attempt and open documentation");
                    return;
                }
            }

            if (this.config instanceof NoConfig) {
                this.logDebug("Creating config interactively");
                this.config = await this.configCreationService.createConfigInteractivly();
                if (this.config instanceof NoConfig) {
                    this.windowMessageService.showWarning("ioBroker: Config not saved. Execute command 'iobroker: Connect to ioBroker' to start another connection attempt.");
                    this.logDebug("Interactive config creation aborted");
                    return;
                }
                else {
                    await this.configRepository.write(this.config, workspaceFolder);
                    this.statusBarService.setStatusBarMessage("ioBroker: Created new 'iobroker-config.json' in root directory");
                    isInitialConnect = true;
                    this.logDebug("New config created");
                }
            }

            this.connectionServiceProvider.getConnectionService().registerConnectionEventListener(this);
            const connectionService = this.connectionServiceProvider.getConnectionService();
            const useAutoReconnect = this.config?.autoReconnect ?? true;
            const allowSelfSignedCertificate = this.config.allowSelfSignedCertificate ?? false;
            const uri = Uri.parse(`${this.config.ioBrokerUrl}:${this.config.socketIoPort}`);
            const timeouts = resolveConnectionTimeouts(this.config);
            connectionService.configureTimeouts(timeouts);
            this.logDebug(`Connection timeouts: ${JSON.stringify(timeouts)}`);
            
            this.logDebug(`Connection Url is '${uri}'`);

            if (allowSelfSignedCertificate) {
                process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
                this.logDebug("Self signed certificates are allowed for connecting to iobroker");
            }

            if (this.config.forceLogin) {
                this.logDebug("Login is forced and login detection therefore skipped");
                forceLogin = true;
            }
            
            this.logDebug(`Force login: ${forceLogin}`);

            let loginType: LoginType;
            if (forceLogin) {
                // Re-authentication must not run the login detection again, because an expired access
                // token can lead to a wrong result. Use the type which was detected for this server before.
                const detected = this.detectedLoginType?.ioBrokerUrl === uri.toString() ? this.detectedLoginType.loginType : undefined;
                loginType = detected ?? LoginType.oAuth2;
            }
            else {
                loginType = await this.loginService.getLoginType(uri, allowSelfSignedCertificate);
                if (loginType !== LoginType.noLogin) {
                    this.detectedLoginType = { ioBrokerUrl: uri.toString(), loginType: loginType };
                }
            }

            if (forceLogin || loginType !== LoginType.noLogin) {
                this.logDebug(`Login is necessary`);

                if (!this.config.username) {
                    this.windowMessageService.showWarning("ioBroker: Login to ioBroker necessary, but no user name is set. Add property 'username' to .iobroker-config.json and try again!");
                    return;
                }

                const token = await this.loginService.getAccessToken(uri, allowSelfSignedCertificate, this.config.username, loginType);
                if (!token) {
                    this.windowMessageService.showWarning("ioBroker: Could not login to ioBroker. Is user name and password correct?");
                    return;
                }

                await connectionService.connectWithToken(uri, useAutoReconnect, allowSelfSignedCertificate, token, this.config.username);
            }
            else {
                this.logDebug("Login not necessary. Connecting to iobroker...");
                await connectionService.connect(uri, useAutoReconnect, allowSelfSignedCertificate);
            }

            this.logDebug("Connection to iobroker successful. Initializing extension...");
            return isInitialConnect;
        } catch (error) {
            const errorMessage = formatError(error);
            this.logDebug(`Connection was not possible due to error: ${errorMessage}`);
            if (this.presenter.current === "reconnecting") {
                this.windowMessageService.showWarning(`ioBroker: Not connected yet (${errorMessage}). Retrying in the background.`);
            }
            else {
                this.windowMessageService.showError(`Could not connect to ioBroker. Check your '.iobroker-config.json' for wrong configuration: ${errorMessage}`);
            }
            return undefined;
        }
    }

    /**
     * Commands call connect() whenever the connection is down. During an auto reconnect this only skips the
     * backoff wait: a full connect would reload all objects, which takes long on slow links.
     * The script list is reloaded by onConnected().
     */
    private async tryRestoreSession(): Promise<boolean> {
        if (!this.isInitialized || this.isConnected() || !this.connectionServiceProvider.isConnectionServiceAvailable()) {
            return false;
        }

        this.logDebug("Session initialized before. Trying fast reconnect...");
        this.statusBarService.setText("$(sync~spin) ioBroker reconnecting now");
        try {
            const restored = await this.connectionServiceProvider.getConnectionService().reconnectNow();
            this.logDebug(`Fast reconnect ${restored ? "succeeded" : "failed, falling back to a full connect"}`);
            if (restored && this.reloadPromise) {
                await this.reloadPromise;
            }
            return restored;
        } catch (error) {
            this.logDebug(`Fast reconnect failed: ${formatError(error)}`);
            return false;
        }
    }

    private async hasConnectionConfigChanged(): Promise<boolean> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        if (workspaceFolder instanceof NoWorkspaceFolder) {
            return false;
        }

        const current = await this.configRepository.read(workspaceFolder);
        if (current instanceof NoConfig) {
            return false;
        }

        return current.ioBrokerUrl !== this.config.ioBrokerUrl
            || current.socketIoPort !== this.config.socketIoPort
            || current.adminVersion !== this.config.adminVersion
            || current.username !== this.config.username
            || current.allowSelfSignedCertificate !== this.config.allowSelfSignedCertificate;
    }

    /** Errors are reported here, so callers can fire and forget. */
    private async runInitialization(isInitialConnect: boolean): Promise<void> {
        this.isInitializing = true;
        try {
            await this.initializeAfterConnect(isInitialConnect);
        } catch (error) {
            const errorMessage = formatError(error);
            this.logDebug(`Initialization failed: ${errorMessage}`);
            if (this.isConnected()) {
                this.presenter.set("loadFailed");
                this.windowMessageService.showError(`ioBroker: Connected, but ${errorMessage}`);
            }
            return;
        } finally {
            this.isInitializing = false;
        }

        const forceObjectIndex = this.isObjectIndexStale;
        this.isObjectIndexStale = false;
        void this.loadObjectIndex(forceObjectIndex);

        if (isInitialConnect) {
            this.logDebug("This is the initial connect. Ask to download all scripts");
            const answer = await window.showQuickPick(["Yes", "No"], { placeHolder: "Download all scripts" });
            if (answer === "Yes") {
                this.logDebug("All scripts will be downloaded...");
                const scripts = this.scriptRepositoryService.getAllScripts();
                await this.scriptService.saveAllToFile(scripts);
                await this.scriptRepositoryService.evaluateScriptOnRemoteForAllScripts();
                await this.scriptRepositoryService.evaluateDirtyStateForAllScripts();
                this.logDebug("All scripts downloaded");
            }
        }
    }

    private async initializeAfterConnect(isInitialConnect: boolean): Promise<void> {
        this.presenter.set("loading");

        await this.runStep("starting the log stream", () => this.logService.startReceiving());
        await this.runStep("loading scripts", () => this.scriptRepositoryService.init(),
            () => `${this.scriptRepositoryService.getAllScripts().length} scripts`);

        this.logDebug("Initialize remote services...");
        this.stateAndObjectRemoteService.init();

        if (this.config.autoUpload && !this.isAutoUploadInitialized) {
            this.logDebug("Auto Upload feature is initialized");
            this.isAutoUploadInitialized = true;
            this.autoUploadService.init();
        }

        this.isInitialized = true;
        this.logDebug(`Initialization done (initial connect: ${isInitialConnect})`);
        if (this.isConnected()) {
            this.presenter.set("connected");
        }
    }

    /** Single flight: reconnect events and connect clicks during a reload share it. */
    private reloadScripts(reason: string): Promise<void> {
        if (!this.reloadPromise) {
            this.reloadPromise = this.doReloadScripts(reason).finally(() => {
                this.reloadPromise = undefined;
            });
        }
        return this.reloadPromise;
    }

    private async doReloadScripts(reason: string): Promise<void> {
        this.logDebug(`Reloading script list (${reason})...`);
        this.presenter.set("loading");
        try {
            await this.runStep("loading scripts", () => this.scriptRepositoryService.reloadFromServer(),
                () => `${this.scriptRepositoryService.getAllScripts().length} scripts`);
        } catch (error) {
            this.logDebug(`Reloading script list failed: ${formatError(error)}`);
            if (this.isConnected()) {
                this.presenter.set("loadFailed");
            }
            return;
        }

        if (this.isConnected()) {
            this.presenter.set("connected");
            void this.loadObjectIndex(false);
        }
    }

    /** The object index (all objects, tens of MB on large installations) only feeds hover and completion. */
    private async loadObjectIndex(force: boolean): Promise<void> {
        if (!force && this.objectRepositoryService.isLoaded()) {
            return;
        }

        this.presenter.setIndexingObjects(true);
        try {
            await this.runStep("indexing objects",
                () => force ? this.objectRepositoryService.rebuild() : this.objectRepositoryService.init(),
                () => `${this.objectRepositoryService.getObjectCount()} objects`);
        } catch (error) {
            const errorMessage = formatError(error);
            this.logDebug(`Object index not loaded: ${errorMessage}`);
            this.statusBarService.setStatusBarMessage(`ioBroker: Object index not loaded (${errorMessage}). It is retried after the next reconnect.`);
        } finally {
            this.presenter.setIndexingObjects(false);
        }
    }

    private async runStep(step: string, action: () => Promise<void>, describeResult?: () => string): Promise<void> {
        const started = Date.now();
        this.logDebug(`Start ${step}...`);
        try {
            await action();
        } catch (error) {
            throw new Error(`${step} failed after ${Date.now() - started} ms: ${formatError(error)}`);
        }
        this.logDebug(`Done ${step} in ${Date.now() - started} ms${describeResult ? ` (${describeResult()})` : ""}`);
    }

    private isConfigValid(): boolean {
        if (
            !this.config.ioBrokerUrl ||
            !this.config.socketIoPort ||
            !this.config.scriptRoot ||
            !this.config.adminVersion || this.config.adminVersion === AdminVersion.unknown
        ) {
            return false;
        }

        return true;
    }

    private logDebug(message: string) {
        this.debugLogService.log(message, "IobrokerConnectionService");
    }
}
