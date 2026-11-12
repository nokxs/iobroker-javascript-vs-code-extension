import * as assert from "assert";
import { AdminVersion } from "../../src/models/Config";
import type { IConnectionService } from "../../src/services/connection/IConnectionService";
import type { IConnectionEventListener } from "../../src/services/connection/IConnectionEventListener";
import type { IConnectionServiceProvider } from "../../src/services/connectionServiceProvider/IConnectionServiceProvider";
import type { IAdminVersionDetector } from "../../src/services/adminVersionDetector/IAdminVersionDetector";
import { EnvConfigRepositoryService } from "../../src/services/remote/EnvConfigRepositoryService";
import { EnvLoginCredentialsService } from "../../src/services/remote/EnvLoginCredentialsService";
import { ConnectionUnavailableError, RemoteConnectionService } from "../../src/services/remote/RemoteConnectionService";
import { Logger } from "../../src/mcp/Logger";
import type { ILoginService } from "../../src/services/loginHttpClient/ILoginService";
import { LoginType } from "../../src/services/loginHttpClient/LoginType";

interface FakeWorld {
    connection: RemoteConnectionService
    logins: () => number
    connects: () => number
    listeners: IConnectionEventListener[]
    credentials: EnvLoginCredentialsService
}

function createWorld(loginFails = false): FakeWorld {
    let connected = false;
    let loginCount = 0;
    let connectCount = 0;
    const listeners: IConnectionEventListener[] = [];

    const credentials = new EnvLoginCredentialsService("super-secret-password");

    const connectionService = <IConnectionService><unknown>{
        get isConnected() {
            return connected;
        },
        connect: async () => {
            connectCount++;
            connected = true;
        },
        connectWithToken: async () => {
            connectCount++;
            connected = true;
        },
        disconnect: async () => {
            connected = false;
        },
        registerConnectionEventListener: (listener: IConnectionEventListener) => {
            if (!listeners.includes(listener)) {
                listeners.push(listener);
            }
        }
    };

    const provider = <IConnectionServiceProvider><unknown>{
        isConnectionServiceAvailable: () => true,
        getConnectionService: () => connectionService
    };

    const detector = <IAdminVersionDetector><unknown>{
        getVersion: async () => AdminVersion.admin7
    };

    const login = <ILoginService><unknown>{
        getLoginType: async () => LoginType.legacy,
        getAccessToken: async () => {
            loginCount++;
            // A tick, so two concurrent callers would both run if there was no single flight.
            await new Promise(resolve => setTimeout(resolve, 5));

            if (loginFails) {
                throw new Error("Invalid password");
            }

            const token = { token: "connect.sid=secret-token", expires: new Date(Date.now() + 3600 * 1000) };
            await credentials.updateAccessToken(token);
            return token.token;
        }
    };

    const configRepository = new EnvConfigRepositoryService({
        ioBrokerUrl: "http://host:8081",
        socketIoPort: 8081,
        username: "admin",
        allowSelfSignedCertificate: false,
        scriptAutoRun: false
    });

    const connection = new RemoteConnectionService(
        configRepository,
        detector,
        provider,
        login,
        credentials,
        new Logger("error"),
        { url: "http://host:8081", username: "admin", allowSelfSignedCertificate: false });

    return {
        connection: connection,
        logins: () => loginCount,
        connects: () => connectCount,
        listeners: listeners,
        credentials: credentials
    };
}

suite("MCP connection", () => {
    test("two concurrent calls share one login and one socket connect", async () => {
        const world = createWorld();

        await Promise.all([world.connection.ensureConnected(), world.connection.ensureConnected()]);

        assert.strictEqual(world.logins(), 1);
        assert.strictEqual(world.connects(), 1);
        assert.strictEqual(world.connection.isConnected(), true);
        assert.strictEqual(world.connection.getState(), "ready");
    });

    test("a failed login reports not_connected and does not hammer ioBroker", async () => {
        const world = createWorld(true);

        await assert.rejects(
            () => world.connection.ensureConnected(),
            (error: Error) => error instanceof ConnectionUnavailableError);

        assert.strictEqual(world.logins(), 1);
        assert.strictEqual(world.connection.getState(), "failed");

        // The cooldown answers immediately, without another login attempt.
        await assert.rejects(
            () => world.connection.ensureConnected(),
            (error: Error) => error instanceof ConnectionUnavailableError);

        assert.strictEqual(world.logins(), 1);
    });

    test("two reauthenticate events run a single login", async () => {
        const world = createWorld();
        await world.connection.ensureConnected();
        const loginsBefore = world.logins();

        world.listeners.forEach(listener => listener.onReAuthenticate());
        world.listeners.forEach(listener => listener.onReAuthenticate());

        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(world.logins(), loginsBefore + 1);
        assert.strictEqual(world.connection.getState(), "ready");
    });

    test("the credentials keep the token in memory only", async () => {
        const credentials = new EnvLoginCredentialsService("super-secret-password");
        assert.strictEqual(await credentials.getPassword(), "super-secret-password");
        assert.strictEqual(await credentials.getAccessToken(), undefined);

        assert.strictEqual(credentials.isValidAccessToken({ token: "t", expires: new Date(Date.now() + 1000) }, new Date()), true);
        assert.strictEqual(credentials.isValidAccessToken({ token: "t", expires: new Date(Date.now() - 1000) }, new Date()), false);
        assert.strictEqual(credentials.isValidAccessToken(undefined, new Date()), false);
    });
});
