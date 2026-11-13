import "reflect-metadata";
import * as assert from "assert";
import { AddressInfo } from "net";
import { WebSocket, WebSocketServer } from "ws";
import { SocketIoClient } from "../../src/services/socketIoClient/SocketIoClient";
import { IDebugLogService } from "../../src/services/debugLogService/IDebugLogService";

const READY = [0, 1, "___ready___"];
const PING = [1];
const RECONNECT_TIMEOUT = 3000;

const silentLog = <IDebugLogService><unknown>{
    log: () => undefined,
    logWarning: () => undefined,
    logError: () => undefined
};

interface FakeAdmin {
    /** Client frames the server received, parsed. */
    received: any[]
    /** Every accepted server side socket, in connect order. */
    sockets: () => WebSocket[]
    connections: () => number
    close: () => Promise<void>
    port: () => number
}

/**
 * A minimal stand-in for the admin websocket endpoint: it sends the ready flag and can drop the
 * socket like the ioBroker server does.
 */
async function startFakeAdmin(onConnection: (socket: WebSocket, index: number) => void): Promise<FakeAdmin> {
    const server = new WebSocketServer({ port: 0 });
    const received: any[] = [];
    const sockets: WebSocket[] = [];
    let connections = 0;

    server.on("connection", socket => {
        connections++;
        sockets.push(socket);
        socket.on("message", data => {
            try {
                received.push(JSON.parse(data.toString()));
            } catch {
                received.push(null);
            }
        });
        onConnection(socket, connections);
    });

    await new Promise<void>(resolve => server.once("listening", () => resolve()));

    return {
        received,
        sockets: () => sockets,
        connections: () => connections,
        port: () => (server.address() as AddressInfo).port,
        close: () => new Promise<void>(resolve => server.close(() => resolve()))
    };
}

async function connectClient(admin: FakeAdmin): Promise<SocketIoClient> {
    const client = new SocketIoClient(silentLog);
    await client.connect(`http://127.0.0.1:${admin.port()}`, {}, false);
    await waitFor(() => client.connected, 5000, "the ready flag");
    return client;
}

async function waitFor(condition: () => boolean, timeoutMs: number, description: string): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.fail(`timed out waiting for ${description}`);
}

suite("SocketIoClient heartbeat", () => {
    test("the client sends its own ping while the server keeps sending messages", async () => {
        const admin = await startFakeAdmin(socket => {
            socket.send(JSON.stringify(READY));
            // A chatty server, like admin: server pings and callbacks keep arriving.
            const interval = setInterval(() => socket.send(JSON.stringify([0, 2, "someEvent"])), 500);
            socket.on("close", () => clearInterval(interval));
        });
        const client = await connectClient(admin);

        try {
            await waitFor(() => client.connected, 5000, "the ready flag");
            // Before the fix the ping check was driven by the last received message, so a chatty
            // server suppressed every client ping and the admin server dropped the socket.
            await waitFor(
                () => admin.received.some(frame => JSON.stringify(frame) === JSON.stringify(PING)),
                9000,
                "a client ping");
        } finally {
            await client.close();
            await admin.close();
        }
    });

    test("a replaced socket cannot tear down the current connection", async () => {
        const admin = await startFakeAdmin(socket => socket.send(JSON.stringify(READY)));
        const client = new SocketIoClient(silentLog);

        try {
            // The admin version detection connects without a cookie and keeps using this client, so
            // the real connect replaces its socket. Its late close must not trigger a reconnect.
            await client.connect(`http://127.0.0.1:${admin.port()}`, {}, false);
            await waitFor(() => client.connected, 5000, "the ready flag of the first socket");

            await client.connect(`http://127.0.0.1:${admin.port()}`, {}, false);
            await waitFor(() => client.connected, 5000, "the ready flag of the second socket");
            await waitFor(() => admin.sockets().length === 2, 2000, "two server sockets");

            admin.sockets()[0].close();
            await new Promise(resolve => setTimeout(resolve, 1000));

            assert.strictEqual(admin.connections(), 2, "the replaced socket must not reconnect");
            assert.strictEqual(client.connected, true, "the current socket must stay connected");
        } finally {
            await client.close();
            await admin.close();
        }
    });

    test("a reconnect keeps the registered listeners and reports the connection as back", async () => {
        const admin = await startFakeAdmin((socket, index) => {
            socket.send(JSON.stringify(READY));
            if (index === 1) {
                setTimeout(() => socket.close(), 200);
            }
        });
        const client = new SocketIoClient(silentLog);
        let reconnects = 0;
        let disconnects = 0;
        client.on("reconnect", () => reconnects++);
        client.on("disconnect", () => disconnects++);

        try {
            await client.connect(`http://127.0.0.1:${admin.port()}`, {}, false);
            await waitFor(() => reconnects > 0, RECONNECT_TIMEOUT * 3, "the reconnect event");
            await waitFor(() => client.connected, 5000, "the connection after the reconnect");

            assert.ok(disconnects > 0, "the disconnect event must reach the listener");
            assert.strictEqual(admin.connections(), 2, "the client must reconnect exactly once");
        } finally {
            await client.close();
            await admin.close();
        }
    });
});

suite("SocketIoClient teardown", () => {
    test("close resolves without a socket and stops a scheduled reconnect", async () => {
        let serverClosed = false;
        const admin = await startFakeAdmin(socket => {
            socket.send(JSON.stringify(READY));
            socket.on("close", () => serverClosed = true);
            setTimeout(() => socket.close(), 200);
        });
        const neverConnected = new SocketIoClient(silentLog);
        await neverConnected.close();

        const client = await connectClient(admin);
        try {
            // Wait until the dropped socket has scheduled its reconnect, then close intentionally.
            await waitFor(() => serverClosed, 3000, "the server side close");
            await client.close();
            // A pending reconnect would attempt a second connection after RECONNECT_TIMEOUT.
            await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT + 1500));

            assert.strictEqual(admin.connections(), 1, "close must not reconnect");
            assert.strictEqual(client.connected, false);
        } finally {
            await client.close();
            await admin.close();
        }
    });

    test("close fails the requests that still wait for an answer", async () => {
        const admin = await startFakeAdmin(socket => socket.send(JSON.stringify(READY)));
        const client = await connectClient(admin);
        let answer: any;

        try {
            client.emit("getState", "state.id", (result: any) => answer = result);
            await client.close();
            await waitFor(() => answer !== undefined, 1000, "the failed request");
            assert.ok(/closed/i.test(String(answer)), `expected a closed error, got ${answer}`);
        } finally {
            await admin.close();
        }
    });
});
