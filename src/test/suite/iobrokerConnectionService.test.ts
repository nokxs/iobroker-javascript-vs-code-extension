import * as assert from 'assert';
import { IobrokerConnectionService } from '../../services/iobrokerConnection/IobrokerConnectionService';
import { AdminVersion, Config } from '../../models/Config';
import { LoginType } from '../../services/loginHttpClient/LoginType';
import { ConnectionServiceAdmin5 } from '../../services/connection/ConnectionServiceAdmin5';
import { ConnectionServiceAdmin4 } from '../../services/connection/ConnectionServiceAdmin4';

interface Deferred {
    promise: Promise<void>;
    resolve: () => void;
}

function deferred(): Deferred {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>(r => { resolve = r; });
    return { promise, resolve };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function createHarness() {
    const calls = { connect: 0, reloadFromServer: 0, scriptInit: 0, objectInit: 0, objectRebuild: 0, errors: [] as string[] };
    let connectGate: Deferred | undefined;
    let objectsLoaded = false;
    let reloadError: Error | undefined;

    const connectionService: any = {
        isConnected: false,
        registerConnectionEventListener: () => undefined,
        configureTimeouts: () => undefined,
        reconnectNow: async () => false,
        connect: async () => {
            calls.connect++;
            if (connectGate) {
                await connectGate.promise;
            }
            connectionService.isConnected = true;
        },
    };

    const config = new Config("http://iobroker", 8081, "scripts", AdminVersion.admin7);
    const service = new IobrokerConnectionService(
        {} as any,
        { read: async () => config, write: async () => undefined } as any,
        { isConnectionServiceAvailable: () => true, getConnectionService: () => connectionService } as any,
        { getWorkspaceToUse: async () => ({ uri: { fsPath: "c:\\ws" } }) } as any,
        {
            startReceiving: async () => undefined,
        } as any,
        {} as any,
        {
            init: async () => { calls.scriptInit++; },
            reloadFromServer: async () => {
                calls.reloadFromServer++;
                if (reloadError) {
                    throw reloadError;
                }
            },
            getAllScripts: () => [],
        } as any,
        { getLoginType: async () => LoginType.noLogin } as any,
        { log: () => undefined } as any,
        { init: () => undefined, setText: () => undefined, setStatusBarMessage: () => undefined } as any,
        { showError: (m: string) => calls.errors.push(m), showWarning: (m: string) => calls.errors.push(m) } as any,
        {
            init: async () => { if (!objectsLoaded) { calls.objectInit++; objectsLoaded = true; } },
            rebuild: async () => { calls.objectRebuild++; objectsLoaded = true; },
            isLoaded: () => objectsLoaded,
            getObjectCount: () => 0,
        } as any,
        { init: () => undefined } as any,
        { init: () => undefined } as any,
    );

    return {
        service,
        connectionService,
        calls,
        gateConnect: () => { connectGate = deferred(); return connectGate; },
        failReload: (error: Error | undefined) => { reloadError = error; },
    };
}

suite('IobrokerConnectionService connect flow', () => {
    test('parallel connect calls share one connect', async () => {
        const h = createHarness();
        const gate = h.gateConnect();

        const first = h.service.connect();
        const second = h.service.connect();
        await flush();
        gate.resolve();
        await Promise.all([first, second]);

        assert.strictEqual(h.calls.connect, 1);
        assert.strictEqual(h.calls.scriptInit, 1);
    });

    test('connect while connected only reloads the scripts', async () => {
        const h = createHarness();
        await h.service.connect();

        await h.service.connect();

        assert.strictEqual(h.calls.connect, 1);
        assert.strictEqual(h.calls.reloadFromServer, 1);
    });

    test('reconnect reloads the script list and keeps the object index', async () => {
        const h = createHarness();
        await h.service.connect();
        await flush();
        assert.strictEqual(h.calls.objectInit, 1);

        h.connectionService.isConnected = false;
        h.service.onDisconnected();
        h.connectionService.isConnected = true;
        h.service.onConnected(3);
        await flush();
        await flush();

        assert.strictEqual(h.calls.reloadFromServer, 1);
        assert.strictEqual(h.calls.objectInit, 1);
        assert.strictEqual(h.calls.objectRebuild, 0);
    });

    test('connected event during a full connect does not start a second load', async () => {
        const h = createHarness();
        const gate = h.gateConnect();

        const connecting = h.service.connect();
        await flush();
        h.service.onConnected(0);
        gate.resolve();
        await connecting;

        assert.strictEqual(h.calls.scriptInit, 1);
        assert.strictEqual(h.calls.reloadFromServer, 0);
    });

    test('failed script reload shows no config error', async () => {
        const h = createHarness();
        await h.service.connect();
        h.failReload(new Error("timeout"));

        await h.service.connect();

        assert.strictEqual(h.calls.reloadFromServer, 1);
        assert.deepStrictEqual(h.calls.errors, []);
    });
});

suite('getSystemObjectView errors', () => {
    for (const [name, create] of [
        ["Admin5", () => new ConnectionServiceAdmin5({} as any)],
        ["Admin4", () => new ConnectionServiceAdmin4()],
    ] as Array<[string, () => any]>) {
        test(`${name} rejects with the server error and does not resolve afterwards`, async () => {
            const service = create();
            service.client = { emit: (...args: any[]) => args[args.length - 1]("permissionError", undefined) };
            service.isConnected = true;

            await assert.rejects(service.getSystemObjectView("script", "script.js.", "script.js."), /permissionError/);
        });

        test(`${name} resolves an empty list for a missing result`, async () => {
            const service = create();
            service.client = { emit: (...args: any[]) => args[args.length - 1](null, undefined) };
            service.isConnected = true;

            assert.deepStrictEqual(await service.getSystemObjectView("script", "script.js.", "script.js."), []);
        });
    }
});
