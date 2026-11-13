import type { Uri as VSCodeUri } from "vscode";
import { URI } from "vscode-uri";
import { AdminVersion } from "../../models/Config";
import { IAdminVersionDetector } from "../adminVersionDetector/IAdminVersionDetector";
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConnectionService } from "../connection/IConnectionService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { ILoginCredentialsService } from "../loginCredentialsService/ILoginCredentialsService";
import { ILoginService } from "../loginHttpClient/ILoginService";
import { LoginType } from "../loginHttpClient/LoginType";
import type { ILogger } from "../../mcp/Logger";
import { EnvConfigRepositoryService } from "./EnvConfigRepositoryService";

/** Section 10.4 of the design. */
export const CONNECT_BUDGET_MS = 10 * 1000;
export const LOGIN_BUDGET_MS = 10 * 1000;
export const SOCKET_BUDGET_MS = 10 * 1000;
export const MAX_LOGIN_ATTEMPTS = 3;
export const FAILED_COOLDOWN_MS = 30 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;
const MIN_REFRESH_DELAY_MS = 5 * 1000;
/** Time a tool call gives the socket client to reconnect on its own before forcing a connect. */
const RECONNECT_GRACE_MS = 10 * 1000;

export type ConnectionState =
    "idle" |
    "connecting" |
    "ready" |
    "reauthenticating" |
    "reconnecting" |
    "failed" |
    "needsAttention";

export interface RemoteConnectionOptions {
    /** `http://host:8081` or `https://host:8081`, including the admin port. */
    url: string
    username?: string
    allowSelfSignedCertificate: boolean
}

/** A connection failure that a tool call should report as `not_connected`, including the hint. */
export class ConnectionUnavailableError extends Error {
    constructor(message: string, readonly hint: string) {
        super(message);
        this.name = "ConnectionUnavailableError";
    }
}

/**
 * Owns connect, reconnect and re-authentication for the MCP server. It replaces
 * `IobrokerConnectionService`, which also manages a config file, the status bar, window messages
 * and the auto upload.
 */
export class RemoteConnectionService implements IConnectionEventListener {
    private state: ConnectionState = "idle";
    private connectPromise: Promise<void> | undefined;
    private reauthPromise: Promise<void> | undefined;
    private detectedLoginType: LoginType | undefined;
    private failedLoginAttempts = 0;
    private lastFailureAt = 0;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private reconnectWaiter: (() => void) | undefined;
    private listenerRegistered = false;
    private readyHook: (() => void) | undefined;
    private readonly baseUri: VSCodeUri;

    constructor(
        private readonly configRepository: EnvConfigRepositoryService,
        private readonly adminVersionDetector: IAdminVersionDetector,
        private readonly connectionServiceProvider: IConnectionServiceProvider,
        private readonly loginService: ILoginService,
        private readonly credentials: ILoginCredentialsService,
        private readonly logger: ILogger,
        private readonly options: RemoteConnectionOptions
    ) {
        this.baseUri = <VSCodeUri><unknown>URI.parse(options.url);
    }

    /** Called once after the first successful connect to start the socket subscriptions. */
    onReady(hook: () => void): void {
        this.readyHook = hook;
    }

    getState(): ConnectionState {
        return this.state;
    }

    /** Synchronous check used by the core functions, which cannot await a connection. */
    isConnected(): boolean {
        if (this.state !== "ready" || !this.connectionServiceProvider.isConnectionServiceAvailable()) {
            return false;
        }

        return this.connectionServiceProvider.getConnectionService().isConnected;
    }

    /**
     * Connects lazily on the first tool call. Concurrent callers wait for the same attempt, so a
     * burst of calls does not create several logins.
     */
    async ensureConnected(): Promise<void> {
        if (this.isConnected()) {
            return;
        }

        if (this.state === "needsAttention") {
            throw new ConnectionUnavailableError(
                "The ioBroker login failed three times.",
                "Update IOBROKER_MCP_PASSWORD and restart the server.");
        }

        // A running login is shared like a running connect: a second attempt would log in twice
        // and race two sockets against each other.
        if (this.state === "reauthenticating" && this.reauthPromise) {
            try {
                await this.reauthPromise;
            } catch (error) {
                throw this.toUnavailableError(error);
            }

            if (this.isConnected()) {
                return;
            }
        }

        // The socket client reconnects on its own with a backoff, so a call that arrives during a
        // short outage waits for it instead of starting one login attempt per call.
        if (this.state === "reconnecting") {
            await this.waitForReconnect();
            if (this.isConnected()) {
                return;
            }

            this.markFailed("The ioBroker connection did not come back.");
        }

        if (this.state === "failed") {
            const remaining = FAILED_COOLDOWN_MS - (Date.now() - this.lastFailureAt);
            if (remaining > 0) {
                throw new ConnectionUnavailableError(
                    "The last connection attempt to ioBroker failed.",
                    `Check IOBROKER_MCP_URL and retry in ${Math.ceil(remaining / 1000)} seconds.`);
            }
        }

        if (!this.connectPromise) {
            const attempt = this.connect();
            this.connectPromise = attempt.then(
                () => { this.connectPromise = undefined; },
                (error: unknown) => { this.connectPromise = undefined; throw error; });
        }

        try {
            await this.connectPromise;
        } catch (error) {
            throw this.toUnavailableError(error);
        }
    }

    /** Closes the socket and stops the refresh timer. Called by the shutdown path only. */
    async stop(): Promise<void> {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }

        // The close fires the disconnect event; a shutdown is not an outage that has to be reported.
        this.state = "idle";

        if (this.connectionServiceProvider.isConnectionServiceAvailable()) {
            try {
                // A connection that never came up has no socket to wait for, so the close is bounded.
                await withTimeout(this.connectionServiceProvider.getConnectionService().disconnect(), 2000, "Shutdown");
            } catch (error) {
                this.logger.debug(`Could not close the ioBroker connection: ${error instanceof Error ? error.message : `${error}`}`);
            }
        }

        // A call that waits for a reconnect must not keep the shutdown hanging.
        this.notifyReconnectWaiter();
    }

    onConnected(): void {
        if (this.state === "connecting" || this.state === "reconnecting") {
            this.markReady();
        }
    }

    onDisconnected(): void {
        if (this.state === "ready" || this.state === "reauthenticating" || this.state === "connecting") {
            this.state = "reconnecting";
            // Anchor the cooldown at the disconnect, so a socket that stays down cannot be
            // retried by every tool call.
            this.lastFailureAt = Date.now();
            this.logger.warn("The ioBroker connection was closed. Reconnecting.");
        }
    }

    onReAuthenticate(): void {
        this.reauthenticate().catch(error => {
            this.logger.error(`Re-authentication failed: ${error instanceof Error ? error.message : `${error}`}`);
        });
    }

    private async connect(): Promise<void> {
        this.state = "connecting";
        this.logger.info(`Connecting to ioBroker on '${this.options.url}'.`);

        // The first connect has one budget including the admin version detection and the login.
        const deadline = Date.now() + CONNECT_BUDGET_MS;

        try {
            const adminVersion = await this.ensureAdminVersion(deadline);
            const service = this.connectionServiceProvider.getConnectionService();
            this.registerListener(service);

            if (adminVersion === AdminVersion.admin4) {
                // Admin 4 has no login: `connectWithToken` would throw.
                await withTimeout(service.connect(this.baseUri, true, this.options.allowSelfSignedCertificate), remaining(deadline), "Socket connection");
            } else {
                const loginType = await this.detectLoginType(remaining(deadline));
                const token = loginType === LoginType.noLogin ? undefined : await this.acquireToken(loginType, remaining(deadline));
                await withTimeout(
                    service.connectWithToken(this.baseUri, true, this.options.allowSelfSignedCertificate, token ?? "", this.options.username ?? null),
                    remaining(deadline),
                    "Socket connection");
            }

            this.failedLoginAttempts = 0;
            this.lastFailureAt = 0;
            this.markReady();
        } catch (error) {
            this.markFailed(`Could not connect to ioBroker: ${error instanceof Error ? error.message : `${error}`}`);
            throw error;
        }
    }

    private async ensureAdminVersion(deadline: number): Promise<AdminVersion> {
        const known = this.configRepository.config.adminVersion;
        if (known && known !== AdminVersion.unknown) {
            return known;
        }

        const detected = await withTimeout(
            this.adminVersionDetector.getVersion(this.options.url, this.options.allowSelfSignedCertificate),
            remaining(deadline),
            "Admin version detection");

        if (!detected || detected === AdminVersion.unknown) {
            throw new Error("Could not determine the ioBroker Admin version. Check IOBROKER_MCP_URL and whether the admin adapter is reachable.");
        }

        this.configRepository.setAdminVersion(detected);
        this.logger.info(`Detected admin version '${detected}'.`);
        return detected;
    }

    /** Detected once and then cached, because an expired token makes detection unreliable. */
    private async detectLoginType(budget: number = LOGIN_BUDGET_MS): Promise<LoginType> {
        if (this.detectedLoginType !== undefined) {
            return this.detectedLoginType;
        }

        const loginType = await withTimeout(
            this.loginService.getLoginType(this.baseUri, this.options.allowSelfSignedCertificate),
            budget,
            "Login type detection");

        this.detectedLoginType = loginType;
        this.logger.info(`Detected login type '${LoginType[loginType]}'.`);
        return loginType;
    }

    private async acquireToken(loginType: LoginType, budget: number = LOGIN_BUDGET_MS): Promise<string> {
        // The missing password is a configuration error, not a rejected attempt, so it is counted
        // exactly once - outside the try, which counts every thrown error.
        const password = await this.credentials.getPassword();
        if (!password) {
            this.registerLoginFailure();
            throw new Error("The ioBroker login is enabled, but IOBROKER_MCP_PASSWORD is not set.");
        }

        try {
            const token = await withTimeout(
                this.loginService.getAccessToken(
                    this.baseUri,
                    this.options.allowSelfSignedCertificate,
                    this.options.username ?? "",
                    loginType),
                budget,
                "Login");

            if (!token) {
                throw new Error("ioBroker did not return an access token.");
            }

            // The token is a session cookie and must never appear in a log line or tool result.
            this.logger.addSecret(token);
            const cookieValue = token.substring(token.indexOf("=") + 1);
            this.logger.addSecret(cookieValue);
            return token;
        } catch (error) {
            this.registerLoginFailure();
            throw error;
        }
    }

    private registerLoginFailure(): void {
        this.failedLoginAttempts++;
        this.logger.warn(`Login attempt ${this.failedLoginAttempts} of ${MAX_LOGIN_ATTEMPTS} failed.`);

        if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            this.state = "needsAttention";
            this.logger.error("The ioBroker login failed three times. Update IOBROKER_MCP_PASSWORD and restart the server.");
        }
    }

    private async reauthenticate(): Promise<void> {
        if (this.state === "needsAttention") {
            return;
        }

        if (!this.reauthPromise) {
            const attempt = this.runReauthenticate();
            this.reauthPromise = attempt.then(
                () => { this.reauthPromise = undefined; },
                (error: unknown) => { this.reauthPromise = undefined; throw error; });
        }

        return this.reauthPromise;
    }

    private async runReauthenticate(): Promise<void> {
        this.state = "reauthenticating";
        this.logger.info("Re-authenticating with ioBroker.");

        const adminVersion = this.configRepository.config.adminVersion;
        const service = this.connectionServiceProvider.getConnectionService();

        try {
            if (adminVersion === AdminVersion.admin4) {
                await withTimeout(service.connect(this.baseUri, true, this.options.allowSelfSignedCertificate), SOCKET_BUDGET_MS, "Socket reconnect");
            } else {
                const loginType = this.detectedLoginType ?? await this.detectLoginType();
                const token = loginType === LoginType.noLogin ? undefined : await this.acquireToken(loginType);
                await withTimeout(
                    service.connectWithToken(this.baseUri, true, this.options.allowSelfSignedCertificate, token ?? "", this.options.username ?? null),
                    SOCKET_BUDGET_MS,
                    "Socket reconnect");
            }

            this.failedLoginAttempts = 0;
            this.markReady();
        } catch (error) {
            // Otherwise the state stays `reauthenticating` and the cooldown never starts.
            this.markFailed(`Re-authentication failed: ${error instanceof Error ? error.message : `${error}`}`);
            throw error;
        }
    }

    private markReady(): void {
        this.state = "ready";
        this.lastFailureAt = 0;
        this.logger.info("Connected to ioBroker.");
        this.notifyReconnectWaiter();
        this.scheduleRefresh();

        if (this.readyHook) {
            try {
                this.readyHook();
            } catch (error) {
                this.logger.warn(`The post-connect hook failed: ${error instanceof Error ? error.message : `${error}`}`);
            }
        }
    }

    /** Enters `failed` and anchors the cooldown. `needsAttention` stays, it requires a restart. */
    private markFailed(reason: string): void {
        if (this.state !== "needsAttention") {
            this.state = "failed";
        }

        this.lastFailureAt = Date.now();
        this.logger.error(reason);
        this.notifyReconnectWaiter();
    }

    /** Waits until the state leaves `reconnecting`, at most one connect budget. */
    private waitForReconnect(): Promise<void> {
        return new Promise<void>(resolve => {
            let timer: ReturnType<typeof setTimeout>;

            const finish = () => {
                clearTimeout(timer);
                if (this.reconnectWaiter === finish) {
                    this.reconnectWaiter = undefined;
                }
                resolve();
            };

            timer = setTimeout(finish, RECONNECT_GRACE_MS);
            this.reconnectWaiter = finish;
        });
    }

    private notifyReconnectWaiter(): void {
        const waiter = this.reconnectWaiter;
        this.reconnectWaiter = undefined;
        waiter?.();
    }

    /** Renews the token shortly before it expires, so tool calls do not run into a stale session. */
    private scheduleRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }

        this.credentials.getAccessToken().then(token => {
            if (!token || !(token.expires instanceof Date) || Number.isNaN(token.expires.getTime())) {
                return;
            }

            const delay = Math.max(MIN_REFRESH_DELAY_MS, token.expires.getTime() - Date.now() - REFRESH_MARGIN_MS);
            this.refreshTimer = setTimeout(() => {
                this.refreshTimer = undefined;
                this.reauthenticate().catch(error => {
                    this.logger.error(`Proactive re-authentication failed: ${error instanceof Error ? error.message : `${error}`}`);
                });
            }, delay);

            // The timer must not keep the process alive after the client closed stdin.
            if (typeof this.refreshTimer.unref === "function") {
                this.refreshTimer.unref();
            }
        }).catch(error => {
            this.logger.debug(`Could not read the access token expiry: ${error instanceof Error ? error.message : `${error}`}`);
        });
    }

    private registerListener(service: IConnectionService): void {
        if (this.listenerRegistered) {
            return;
        }

        service.registerConnectionEventListener(this);
        this.listenerRegistered = true;
    }

    private toUnavailableError(error: unknown): ConnectionUnavailableError {
        if (error instanceof ConnectionUnavailableError) {
            return error;
        }

        const message = error instanceof Error ? error.message : `${error}`;
        if (this.state === "needsAttention") {
            return new ConnectionUnavailableError(message, "Update IOBROKER_MCP_PASSWORD and restart the server.");
        }

        return new ConnectionUnavailableError(
            message,
            "Check IOBROKER_MCP_URL, IOBROKER_MCP_USERNAME and IOBROKER_MCP_PASSWORD, then retry.");
    }
}

/** The time that is left of a connect budget, never zero so a timeout is still possible. */
function remaining(deadline: number): number {
    return Math.max(1, deadline - Date.now());
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} did not finish within ${Math.round(timeoutMs / 1000)} seconds.`));
        }, timeoutMs);

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
