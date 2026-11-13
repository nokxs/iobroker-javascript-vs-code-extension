import 'reflect-metadata';
import * as assert from 'assert';
import { AddressInfo } from 'net';
import WebSocket = require('ws');
import { SocketIoClient } from '../../services/socketIoClient/SocketIoClient';
import { IDebugLogService } from '../../services/debugLogService/IDebugLogService';
import {
    ConnectionTimeouts,
    DEFAULT_CONNECTION_TIMEOUTS,
    computeReconnectDelay,
    isFastReconnectPhase,
    resolveConnectionTimeouts,
} from '../../services/socketIoClient/ConnectionTimeouts';

const silentLog = {
    log: () => undefined,
    logWarning: () => undefined,
    logError: () => undefined,
} as unknown as IDebugLogService;

const FAST: ConnectionTimeouts = {
    connectionTimeoutMs: 2000,
    readyTimeoutMs: 300,
    authTimeoutMs: 300,
    pingIntervalMs: 100,
    heartbeatTimeoutMs: 400,
    reconnectBaseDelayMs: 50,
    reconnectMaxDelayMs: 200,
    fastReconnectDelayMs: 50,
    fastReconnectWindowMs: 1000,
};

type ServerMode = 'ready' | 'silent';

interface TestServer {
    url: string;
    wss: WebSocket.Server;
    connections: number;
    mode: ServerMode;
    dropAll(): void;
    close(): Promise<void>;
}

async function startServer(mode: ServerMode): Promise<TestServer> {
    const wss = new WebSocket.Server({ port: 0, host: '127.0.0.1' });
    await new Promise<void>(resolve => wss.once('listening', () => resolve()));
    const server: TestServer = {
        url: `http://127.0.0.1:${(wss.address() as AddressInfo).port}`,
        wss,
        connections: 0,
        mode,
        dropAll: () => wss.clients.forEach(c => c.terminate()),
        close: () => new Promise<void>(resolve => {
            wss.clients.forEach(c => c.terminate());
            wss.close(() => resolve());
        }),
    };
    wss.on('connection', socket => {
        server.connections++;
        socket.on('message', raw => {
            const data = JSON.parse(raw.toString());
            if (data[0] === 1) {
                socket.send(JSON.stringify([2]));
            }
        });
        if (server.mode === 'ready') {
            socket.send(JSON.stringify([0, 0, '___ready___']));
        }
    });
    return server;
}

function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            if (predicate()) {
                clearInterval(timer);
                resolve();
            } else if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                reject(new Error('waitFor timed out'));
            }
        }, 10);
    });
}

function createClient(): SocketIoClient {
    const client = new SocketIoClient(silentLog);
    client.configure(FAST);
    client.autoReconnect = true;
    return client;
}

suite('SocketIoClient reconnect', function () {
    this.timeout(10000);

    let server: TestServer | undefined;
    let client: SocketIoClient | undefined;
    const uncaught: unknown[] = [];
    const onUncaught = (e: unknown) => uncaught.push(e);

    suiteSetup(() => {
        process.on('uncaughtException', onUncaught);
        process.on('unhandledRejection', onUncaught);
    });

    suiteTeardown(() => {
        process.removeListener('uncaughtException', onUncaught);
        process.removeListener('unhandledRejection', onUncaught);
    });

    setup(() => {
        uncaught.length = 0;
    });

    teardown(async () => {
        await client?.close();
        await server?.close();
        client = undefined;
        server = undefined;
    });

    test('connects and fires connect once', async () => {
        server = await startServer('ready');
        client = createClient();
        let connects = 0;
        client.on('connect', () => connects++);

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);

        assert.strictEqual(connects, 1);
        assert.deepStrictEqual(uncaught, []);
    });

    test('missing ready message schedules exactly one reconnect per attempt', async () => {
        server = await startServer('silent');
        client = createClient();
        const attempts: number[] = [];
        client.on('reconnecting', (attempt: number) => attempts.push(attempt));

        await client.connect(server.url, {}, false);
        await waitFor(() => attempts.length >= 2);

        assert.deepStrictEqual(attempts.slice(0, 2), [1, 2]);
        assert.ok(server.connections >= 2, `expected >= 2 connections, got ${server.connections}`);
        assert.deepStrictEqual(uncaught, []);
    });

    test('server drop leads to connectionLost, disconnect and reconnect with kept handlers', async () => {
        server = await startServer('ready');
        client = createClient();
        const events: string[] = [];
        let reconnectAttempts = -1;
        client.on('connect', () => events.push('connect'));
        client.on('connectionLost', (reason: string) => events.push(`lost:${reason}`));
        client.on('disconnect', () => events.push('disconnect'));
        client.on('reconnect', (_: boolean, attempts: number) => {
            events.push('reconnect');
            reconnectAttempts = attempts;
        });

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);

        server.dropAll();
        await waitFor(() => events.includes('reconnect'));

        assert.strictEqual(events[0], 'connect');
        assert.ok(events[1].startsWith('lost:'), events.join(','));
        assert.strictEqual(events[2], 'disconnect');
        assert.strictEqual(events[3], 'reconnect');
        assert.ok(reconnectAttempts >= 1);
        assert.strictEqual(client.connected, true);
        assert.deepStrictEqual(uncaught, []);
    });

    test('server that is down for a while is reached again after it comes back', async () => {
        server = await startServer('ready');
        client = createClient();
        let reconnected = false;
        client.on('reconnect', () => { reconnected = true; });

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);

        server.mode = 'silent';
        server.dropAll();
        await waitFor(() => server!.connections >= 3);
        assert.strictEqual(reconnected, false);

        server.mode = 'ready';
        await waitFor(() => reconnected);
        assert.deepStrictEqual(uncaught, []);
    });

    test('missing heartbeat is detected as connection loss', async () => {
        server = await startServer('ready');
        server.wss.on('connection', socket => {
            // Stop answering pings after ready.
            socket.removeAllListeners('message');
        });
        client = createClient();
        const reasons: string[] = [];
        client.on('connectionLost', (reason: string) => reasons.push(reason));

        await client.connect(server.url, {}, false);
        await waitFor(() => reasons.length > 0);

        assert.ok(reasons[0].includes('heartbeat'), reasons[0]);
        assert.deepStrictEqual(uncaught, []);
    });

    test('pending callbacks are failed when the connection is lost', async () => {
        server = await startServer('ready');
        client = createClient();
        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);

        let answer: unknown;
        client.emit('getState', 'some.id', (err: unknown) => { answer = err; });
        server.dropAll();
        await waitFor(() => answer !== undefined);

        assert.ok(`${answer}`.startsWith('Connection lost'), `${answer}`);
    });

    test('re-entrant connection loss handling does not throw', async () => {
        server = await startServer('ready');
        client = createClient();
        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);

        const anyClient = client as any;
        assert.doesNotThrow(() => {
            anyClient.handleConnectionLoss('first');
            anyClient.handleConnectionLoss('second');
            server!.dropAll();
            anyClient.handleConnectionLoss('third');
        });

        await waitFor(() => client!.connected);
        assert.deepStrictEqual(uncaught, []);
    });

    test('close stops a running reconnect loop', async () => {
        server = await startServer('silent');
        client = createClient();
        await client.connect(server.url, {}, false);
        await waitFor(() => server!.connections >= 2);

        await client.close();
        const connectionsAfterClose = server.connections;
        await new Promise(resolve => setTimeout(resolve, 600));

        assert.strictEqual(server.connections, connectionsAfterClose);
        assert.deepStrictEqual(uncaught, []);
    });

    test('client keeps a server alive that closes sockets which send nothing (ws-server rule)', async () => {
        server = await startServer('ready');
        server.wss.on('connection', socket => {
            let lastClientMessage = Date.now();
            socket.on('message', () => { lastClientMessage = Date.now(); });
            // The client receives all the time, as during a large download, so only a send-based keepalive helps.
            const check = setInterval(() => {
                if (Date.now() - lastClientMessage > 300) {
                    socket.close();
                    return;
                }
                socket.send(JSON.stringify([0, 0, 'tick']));
            }, 50);
            socket.on('close', () => clearInterval(check));
        });
        client = createClient();
        const reasons: string[] = [];
        client.on('connectionLost', (reason: string) => reasons.push(reason));

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);
        await new Promise(resolve => setTimeout(resolve, 1200));

        assert.deepStrictEqual(reasons, []);
        assert.strictEqual(server.connections, 1);
    });

    test('a slowly arriving large message does not trigger the heartbeat timeout', async () => {
        server = await startServer('ready');
        server.wss.on('connection', socket => {
            socket.removeAllListeners('message');
            const payload = JSON.stringify([0, 1, 'bigEvent', ['x'.repeat(2000)]]);
            const parts = 12;
            const size = Math.ceil(payload.length / parts);
            let index = 0;
            const timer = setInterval(() => {
                const chunk = payload.substring(index * size, (index + 1) * size);
                index++;
                const fin = index >= parts;
                socket.send(chunk, { fin });
                if (fin) {
                    clearInterval(timer);
                }
            }, 100);
            socket.on('close', () => clearInterval(timer));
        });
        client = createClient();
        const reasons: string[] = [];
        let received = '';
        client.on('connectionLost', (reason: string) => reasons.push(reason));
        client.on('bigEvent', (value: string) => { received = value; });

        await client.connect(server.url, {}, false);
        await waitFor(() => received.length > 0);

        assert.strictEqual(received.length, 2000);
        assert.deepStrictEqual(reasons, []);
    });

    test('reconnectNow skips a long backoff wait', async () => {
        server = await startServer('ready');
        client = createClient();
        client.configure({ ...FAST, reconnectBaseDelayMs: 5000, reconnectMaxDelayMs: 5000, fastReconnectWindowMs: 1000, fastReconnectDelayMs: 5000 });
        let reconnected = false;
        client.on('reconnect', () => { reconnected = true; });

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);
        server.dropAll();
        await waitFor(() => !client!.connected);

        client.reconnectNow();
        await waitFor(() => reconnected, 1500);
        assert.deepStrictEqual(uncaught, []);
    });

    test('loss of an established connection retries at the fast delay instead of growing the backoff', async () => {
        server = await startServer('ready');
        client = createClient();
        client.configure({ ...FAST, reconnectBaseDelayMs: 2000, reconnectMaxDelayMs: 2000, fastReconnectDelayMs: 50, fastReconnectWindowMs: 5000 });
        const delays: number[] = [];
        client.on('reconnecting', (_: number, delay: number) => delays.push(delay));

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);
        server.mode = 'silent';
        server.dropAll();
        await waitFor(() => delays.length >= 3);

        assert.deepStrictEqual(delays.slice(0, 3), [50, 50, 50]);
        assert.deepStrictEqual(uncaught, []);
    });

    test('after the fast window the exponential backoff takes over', async () => {
        server = await startServer('ready');
        client = createClient();
        client.configure({ ...FAST, reconnectBaseDelayMs: 300, reconnectMaxDelayMs: 300, fastReconnectDelayMs: 50, fastReconnectWindowMs: 200 });
        const delays: number[] = [];
        client.on('reconnecting', (_: number, delay: number) => delays.push(delay));

        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);
        server.mode = 'silent';
        server.dropAll();
        await waitFor(() => delays.some(d => d >= 300), 4000);

        assert.strictEqual(delays[0], 50);
        assert.deepStrictEqual(uncaught, []);
    });

    test('a failed initial connect uses the exponential backoff, not the fast delay', async () => {
        server = await startServer('silent');
        client = createClient();
        client.configure({ ...FAST, reconnectBaseDelayMs: 120, reconnectMaxDelayMs: 120, fastReconnectDelayMs: 10, fastReconnectWindowMs: 5000 });
        const delays: number[] = [];
        client.on('reconnecting', (_: number, delay: number) => delays.push(delay));

        await client.connect(server.url, {}, false);
        await waitFor(() => delays.length >= 2);

        assert.ok(delays.every(d => d >= 120), delays.join(','));
    });

    test('emit while disconnected after a connection answers the callback', async () => {
        server = await startServer('ready');
        client = createClient();
        client.autoReconnect = false;
        await client.connect(server.url, {}, false);
        await waitFor(() => client!.connected);
        await client.close();

        let answer: unknown;
        client.emit('getState', 'x', (err: unknown) => { answer = err; });
        await waitFor(() => answer !== undefined);
        assert.strictEqual(answer, 'Not connected');
    });
});

suite('ConnectionTimeouts', () => {
    test('defaults are used for missing or invalid values', () => {
        assert.deepStrictEqual(resolveConnectionTimeouts(undefined), { ...DEFAULT_CONNECTION_TIMEOUTS });
        const resolved = resolveConnectionTimeouts({ readyTimeoutMs: 'x', heartbeatTimeoutMs: NaN });
        assert.strictEqual(resolved.readyTimeoutMs, DEFAULT_CONNECTION_TIMEOUTS.readyTimeoutMs);
        assert.strictEqual(resolved.heartbeatTimeoutMs, DEFAULT_CONNECTION_TIMEOUTS.heartbeatTimeoutMs);
    });

    test('values are clamped and ping interval follows the heartbeat timeout', () => {
        const resolved = resolveConnectionTimeouts({ readyTimeoutMs: 10, heartbeatTimeoutMs: 6000, reconnectMaxDelayMs: 99999999 });
        assert.strictEqual(resolved.readyTimeoutMs, 1000);
        assert.strictEqual(resolved.heartbeatTimeoutMs, 6000);
        assert.strictEqual(resolved.pingIntervalMs, 2000);
        assert.strictEqual(resolved.reconnectMaxDelayMs, 10 * 60 * 1000);
    });

    test('fast reconnect phase is limited to its window', () => {
        assert.strictEqual(isFastReconnectPhase(1000, undefined, 45000), false);
        assert.strictEqual(isFastReconnectPhase(1000, 0, 45000), true);
        assert.strictEqual(isFastReconnectPhase(45000, 0, 45000), false);
        assert.strictEqual(DEFAULT_CONNECTION_TIMEOUTS.reconnectMaxDelayMs, 30000);
    });

    test('reconnect delay grows exponentially and is capped', () => {
        const noJitter = () => 0.5;
        assert.strictEqual(computeReconnectDelay(1, 2000, 60000, noJitter), 2000);
        assert.strictEqual(computeReconnectDelay(2, 2000, 60000, noJitter), 4000);
        assert.strictEqual(computeReconnectDelay(3, 2000, 60000, noJitter), 8000);
        assert.strictEqual(computeReconnectDelay(10, 2000, 60000, noJitter), 60000);
        assert.strictEqual(computeReconnectDelay(1000, 2000, 60000, noJitter), 60000);
    });

    test('jitter stays within bounds', () => {
        for (let i = 0; i < 50; i++) {
            const delay = computeReconnectDelay(4, 2000, 60000);
            assert.ok(delay >= 12800 && delay <= 19200, `${delay}`);
        }
    });
});
