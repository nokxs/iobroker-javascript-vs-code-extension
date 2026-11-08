import * as assert from 'assert';
import { ConnectionServiceAdmin5 } from '../../services/connection/ConnectionServiceAdmin5';
import { ILogMessage } from '../../models/ILogMessage';
import { ISocketIoClient } from '../../services/socketIoClient/ISocketIoClient';

function createFakeSocket(): ISocketIoClient & { handlerCount(name: string): number } {
    const handlers: Record<string, Array<(...args: any[]) => void>> = {};
    const fake = {
        connected: true,
        autoReconnect: false,
        connect: async () => fake,
        withCallback: () => undefined,
        findAnswer: () => undefined,
        emit: (_name: string, arg1?: any, arg2?: any) => {
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
    };
    return fake as ISocketIoClient & { handlerCount(name: string): number };
}

suite('ConnectionServiceAdmin5 log registration', () => {
    test('unregisterForLogs removes the exact handler registered by registerForLogs', async () => {
        const fake = createFakeSocket();
        const service = new ConnectionServiceAdmin5(fake);
        (service as any).client = fake;
        (service as any).isConnected = true;

        const handler = (message: ILogMessage): void => { void message; };

        await service.registerForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 1);

        await service.unregisterForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 0);
    });

    test('registerForLogs twice with the same handler leaves exactly one listener', async () => {
        const fake = createFakeSocket();
        const service = new ConnectionServiceAdmin5(fake);
        (service as any).client = fake;
        (service as any).isConnected = true;

        const handler = (message: ILogMessage): void => { void message; };

        await service.registerForLogs(handler);
        await service.registerForLogs(handler);
        assert.strictEqual(fake.handlerCount('log'), 1);
    });
});
