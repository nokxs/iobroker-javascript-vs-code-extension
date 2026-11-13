import * as assert from 'assert';
import { ConnectionServiceAdmin5 } from '../../services/connection/ConnectionServiceAdmin5';
import { ILogMessage } from '../../models/ILogMessage';
import { ISocketIoClient } from '../../services/socketIoClient/ISocketIoClient';
import { IConnectionEventListener } from '../../services/connection/IConnectionEventListener';

type FakeSocket = ISocketIoClient & {
    handlerCount(name: string): number;
    fire(name: string, ...args: any[]): void;
    emitted: Array<{ name: string, args: any[] }>;
};

function createFakeSocket(): FakeSocket {
    const handlers: Record<string, Array<(...args: any[]) => void>> = {};
    const emitted: Array<{ name: string, args: any[] }> = [];
    const fake = {
        connected: true,
        autoReconnect: false,
        emitted,
        configure: () => undefined,
        reconnectNow: () => undefined,
        connect: async () => fake,
        withCallback: () => undefined,
        findAnswer: () => undefined,
        emit: (name: string, arg1?: any, arg2?: any) => {
            emitted.push({ name, args: [arg1, arg2] });
            const callback = typeof arg1 === 'function' ? arg1 : arg2;
            if (typeof callback === 'function') {
                callback(null);
            }
        },
        on: (name: any, cb: any) => {
            if (!cb) {
                return;
            }
            handlers[name] = handlers[name] || [];
            if (handlers[name].includes(cb)) {
                return;
            }
            handlers[name].push(cb);
        },
        off: (name: any, cb?: any) => {
            if (!handlers[name]) {
                return;
            }
            const pos = handlers[name].indexOf(cb);
            if (pos !== -1) {
                handlers[name].splice(pos, 1);
                if (!handlers[name].length) {
                    delete handlers[name];
                }
            }
        },
        close: async () => fake,
        handlerCount: (name: string) => handlers[name]?.length ?? 0,
        fire: (name: string, ...args: any[]) => {
            [...(handlers[name] ?? [])].forEach(cb => cb(...args));
        },
    };
    return fake as unknown as FakeSocket;
}

function createService(fake: FakeSocket): ConnectionServiceAdmin5 {
    const service = new ConnectionServiceAdmin5(fake);
    (service as any).client = fake;
    (service as any).isConnected = true;
    (service as any).registerSocketEvents();
    return service;
}

suite('ConnectionServiceAdmin5 log registration', () => {
    test('unregisterForLogs removes the exact handler registered by registerForLogs', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);

        const handler = (message: ILogMessage): void => { void message; };

        await service.registerForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 1);

        await service.unregisterForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 0);
    });

    test('registerForLogs twice with the same handler leaves exactly one listener', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);

        const handler = (message: ILogMessage): void => { void message; };

        await service.registerForLogs(handler);
        await service.registerForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 1);
    });

    test('requireLog is sent again after an automatic reconnect', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        await service.registerForLogs(() => undefined);
        fake.emitted.length = 0;

        fake.fire('disconnect');
        assert.strictEqual(service.isConnected, false);
        fake.fire('reconnect', true, 3);

        assert.strictEqual(service.isConnected, true);
        const renewed = fake.emitted.filter(e => e.name === 'requireLog' && e.args[0] === true);
        assert.strictEqual(renewed.length, 1);
    });

    test('requireLog is not sent after reconnect when nobody listens for logs', async () => {
        const fake = createFakeSocket();
        createService(fake);

        fake.fire('reconnect', true, 1);

        assert.strictEqual(fake.emitted.filter(e => e.name === 'requireLog').length, 0);
    });

    test('registerForLogs while disconnected resolves and subscribes on reconnect', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        (service as any).isConnected = false;

        await service.registerForLogs(() => undefined);
        assert.strictEqual(fake.emitted.length, 0);

        fake.fire('reconnect', true, 1);
        assert.strictEqual(fake.emitted.filter(e => e.name === 'requireLog').length, 1);
    });

    test('unregisterForLogs while disconnected resolves instead of hanging', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        const handler = (): void => undefined;
        await service.registerForLogs(handler);
        (service as any).isConnected = false;

        await service.unregisterForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 0);
    });

    test('re-registering the same object pattern replaces the previous handler', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);

        await service.registerForObjectChange('script.js.*', () => undefined);
        await service.registerForObjectChange('script.js.*', () => undefined);
        assert.strictEqual(fake.handlerCount('objectChange'), 1);

        await service.unregisterObjectChange('script.js.*');
        assert.strictEqual(fake.handlerCount('objectChange'), 0);
    });

    test('reconnectNow resolves true once the session is restored', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        (service as any).isConnected = false;
        (fake as any).reconnectNow = () => setTimeout(() => fake.fire('reconnect', true, 2), 10);

        assert.strictEqual(await service.reconnectNow(), true);
        assert.strictEqual(service.isConnected, true);
        assert.strictEqual(fake.handlerCount('reconnect'), 1);
    });

    test('reconnectNow resolves false when the connection is not restored in time', async () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        (service as any).isConnected = false;
        service.configureTimeouts({ ...(service as any).timeouts, connectionTimeoutMs: 50 });

        assert.strictEqual(await service.reconnectNow(), false);
    });

    test('socket events are registered only once', () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        (service as any).registerSocketEvents();
        (service as any).registerSocketEvents();
        assert.strictEqual(fake.handlerCount('disconnect'), 1);
        assert.strictEqual(fake.handlerCount('reconnect'), 1);
    });

    test('listeners receive connection lost, reconnecting and reconnect attempts', () => {
        const fake = createFakeSocket();
        const service = createService(fake);
        const events: string[] = [];
        const listener: IConnectionEventListener = {
            onConnected: (attempts?: number) => events.push(`connected:${attempts}`),
            onDisconnected: () => events.push('disconnected'),
            onReAuthenticate: () => events.push('reauth'),
            onConnectionLost: (reason: string) => events.push(`lost:${reason}`),
            onReconnecting: (attempt: number, delayMs: number) => events.push(`reconnecting:${attempt}:${delayMs}`),
        };
        service.registerConnectionEventListener(listener);

        fake.fire('connectionLost', 'close code 1006');
        fake.fire('disconnect');
        fake.fire('reconnecting', 1, 2000);
        fake.fire('reconnect', true, 1);

        assert.deepStrictEqual(events, ['lost:close code 1006', 'disconnected', 'reconnecting:1:2000', 'connected:1']);
    });
});
