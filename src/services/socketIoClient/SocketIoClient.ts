/**
 * 
 * This is a type script compilable version of the client of the ioBroker admin adapter
 * from https://github.com/ioBroker/ioBroker.admin/blob/18aef11bd262c069dd9ba266950811d4c10931ae/src-rx/public/lib/js/socket.io.js
 * 
 * Reconnect handling was reworked for high-latency / lossy links: every websocket belongs to a
 * generation, events of stale sockets are ignored, tearing down a socket is synchronous and idempotent,
 * and reconnects use exponential backoff.
 * 
 */

import { ISocketIoClient } from "./ISocketIoClient";
import { inject, injectable } from "inversify";

import WebSocket = require("ws");
import TYPES from "../../Types";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { ConnectionTimeouts, DEFAULT_CONNECTION_TIMEOUTS, FAST_RECONNECT_COOLDOWN_MS, computeReconnectDelay, isFastReconnectPhase } from "./ConnectionTimeouts";

// Close codes: 1000 normal, 1001 going away, 1006 abnormal (no close frame), 1011 server error,
// 1012 service restart, 1015 TLS handshake failure.

const WS_READY_STATE = {
    connecting: 0,
    open: 1,
    closing: 2,
    closed: 3
};

const MESSAGE_TYPES = {
    message: 0,
    ping: 1,
    pong: 2,
    callback: 3
};

const DEBUG = true;

const noop = (): void => undefined;

@injectable()
export class SocketIoClient implements ISocketIoClient {

    private handlers: any = {};
    private lastPong: number = 0;
    private lastSent: number = 0;
    private socket: WebSocket | null = null;
    private generation = 0;
    private wasConnected = false;
    private explicitlyClosed = false;
    private reconnectAttempt = 0;
    /** Counts only the attempts of the exponential phase, so the fast phase does not grow the backoff. */
    private backoffAttempt = 0;
    private fastPhaseStartedAt: number | undefined = undefined;
    private connectTimer: any = null;
    private connectingTimer: any = null;
    private callbacks: any = [];
    private pending: Array<{ name: string, args: any[] }> = []; // pending requests till connection established
    private url: String = "";
    private options: any = {};
    private allowSelfSignedCertificate: boolean = false;
    private pingInterval: any = null;
    private id = 0;
    private sessionID: any;
    private authTimeout: any = null;
    private timeouts: ConnectionTimeouts = { ...DEFAULT_CONNECTION_TIMEOUTS };
    
    public connected = false;
    public autoReconnect = true;

    log = {
        debug: (text: string) => this.debugLogService.log(text, "SocketIoClient"),
        warn:  (text: string) => this.debugLogService.logWarning(text, "SocketIoClient"),
        error: (text: string) => this.debugLogService.logError(text, "SocketIoClient")
    };
    constructor(@inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService) {
        this.connected = false; // simulate socket.io interface
    }

    configure(timeouts: ConnectionTimeouts): void {
        this.timeouts = { ...timeouts };
    }

    async connect(_url: any, _options: any, _allowSelfSignedCertificate: boolean): Promise<ISocketIoClient> {
        this.log.debug(`Try to connect to ${_url}`);
        this.explicitlyClosed = false;
        this.clearConnectTimer();
        this.teardownSocket("new connection requested", false);

        this.id = 0;
        this.url = _url || this.url;
        this.options = _options || this.options || {};
        this.allowSelfSignedCertificate = _allowSelfSignedCertificate || this.allowSelfSignedCertificate;
        this.sessionID = Date.now();

        const gen = ++this.generation;
        let ws: WebSocket;
        try {
            let u = this.url.replace(/^http/, 'ws').split('?')[0] + '?sid=' + this.sessionID;
            if (this.options.name) {
                u += '&name=' + encodeURIComponent(this.options.name);
            }
            const wsOptions: WebSocket.ClientOptions = {
                rejectUnauthorized: !this.allowSelfSignedCertificate,
                handshakeTimeout: this.timeouts.readyTimeoutMs,
            };
            if (this.options.cookie) {
                wsOptions.headers = { "cookie": this.options.cookie };
            }
            this.log.debug(`Created websocket ${this.options.cookie ? "with" : "without"} authorization. AllowSelfSignedCertificate: ${this.allowSelfSignedCertificate}`);
            ws = new WebSocket(u, wsOptions);
        } catch (error) {
            this.log.error(`Exception while creating websocket: ${error}`);
            this.fire("error", `${error}`);
            this.scheduleReconnect();
            return this;
        }

        this.socket = ws;
        const isCurrent = (): boolean => gen === this.generation && ws === this.socket;

        this.connectingTimer = setTimeout(() => {
            this.connectingTimer = null;
            if (!isCurrent()) {
                return;
            }
            this.log.warn(`No READY flag received in ${this.timeouts.readyTimeoutMs} ms. Re-init`);
            this.handleConnectionLoss(`no ready message within ${Math.round(this.timeouts.readyTimeoutMs / 1000)} s`);
        }, this.timeouts.readyTimeoutMs);

        ws.onopen = () => {
            if (!isCurrent()) {
                return;
            }
            this.lastPong = Date.now();
            this.lastSent = Date.now();
            // A large message (e.g. getAllObjects) can take longer than the heartbeat timeout on a slow
            // link; raw bytes prove that the connection is alive before the message is complete.
            const rawSocket = (ws as any)._socket;
            rawSocket?.on?.("data", () => {
                if (isCurrent()) {
                    this.lastPong = Date.now();
                }
            });
            const checkIntervalMs = Math.max(250, Math.floor(this.timeouts.pingIntervalMs / 2));
            this.pingInterval = setInterval(() => this.checkHeartbeat(isCurrent), checkIntervalMs);
        };

        ws.onclose = (event: { code: number, reason?: string }) => {
            if (!isCurrent()) {
                return;
            }
            this.log.warn(`ws closed with code ${event.code}${event.reason ? ` (${event.reason})` : ""}`);
            this.handleConnectionLoss(`close code ${event.code}`);
        };

        ws.onerror = (error: any) => {
            if (!isCurrent()) {
                return;
            }
            const message = error?.message ?? `${error}`;
            this.log.warn(`ws error: ${message}`);
            this.fire("error", `Error Code: ${error?.error?.code || error?.code || 'UNKNOWN'}; Message: ${message}`);
            this.handleConnectionLoss(`socket error: ${message}`);
        };

        ws.onmessage = (message: any) => {
            if (!isCurrent()) {
                return;
            }
            try {
                this.handleMessage(message);
            } catch (e) {
                this.log.error(`Error while handling message: ${e}`);
            }
        };

        return this;
    }

    private handleMessage(message: any): void {
        this.lastPong = Date.now();
        if (!message || !message.data || typeof message.data !== 'string') {
            return this.log.error('Received invalid message: ' + JSON.stringify(message));
        }
        let data;
        try {
            data = JSON.parse(message.data);
        } catch (e) {
            return this.log.error('Received invalid message: ' + JSON.stringify(message.data));
        }

        const [type, id, name, args] = data;

        if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
        }

        if (type === MESSAGE_TYPES.callback) {
            this.findAnswer(id, args);
        } else if (type === MESSAGE_TYPES.message) {
            if (name === '___ready___') {
                this.connected = true;

                this.connectingTimer && clearTimeout(this.connectingTimer);
                this.connectingTimer = null;

                const attempts = this.reconnectAttempt;
                this.reconnectAttempt = 0;
                this.backoffAttempt = 0;

                if (this.wasConnected) {
                    this.fire("reconnect", true, attempts);
                } else {
                    this.wasConnected = true;
                    this.fire("connect", true);
                }

                // resend all pending requests
                if (this.pending.length) {
                    const pending = this.pending;
                    this.pending = [];
                    pending.forEach(p => this.emit(p.name, ...p.args));
                }
            } else if (args) {
                this.fire(name, args[0], args[1], args[2], args[3], args[4]);
            } else {
                this.fire(name);
            }
        } else if (type === MESSAGE_TYPES.ping) {
            this.send(JSON.stringify([MESSAGE_TYPES.pong]));
        } else if (type === MESSAGE_TYPES.pong) {
            // lastPong saved
        } else {
            this.log.warn('Received unknown message type: ' + type);
        }
    }

    private checkHeartbeat(isCurrent: () => boolean): void {
        if (!isCurrent()) {
            return;
        }
        const silence = Date.now() - this.lastPong;
        if (silence > this.timeouts.heartbeatTimeoutMs) {
            this.log.warn(`No message received for ${silence} ms. Reconnect`);
            this.handleConnectionLoss(`no heartbeat for ${Math.round(silence / 1000)} s`);
            return;
        }
        if (Date.now() - this.lastSent >= this.timeouts.pingIntervalMs) {
            if (!this.send(JSON.stringify([MESSAGE_TYPES.ping]))) {
                this.handleConnectionLoss("cannot send ping");
                return;
            }
        }
        this._garbageCollect();
    }

    _garbageCollect(): void {
        const now = Date.now();
        let empty = 0;
        if (!DEBUG) {
            for (let i = 0; i < this.callbacks.length; i++) {
                if (this.callbacks[i]) {
                    if (this.callbacks[i].ts > now) {
                        const cb = this.callbacks[i].cb;
                        setTimeout(cb, 0, 'timeout');
                        this.callbacks[i] = null;
                        empty++;
                    }
                } else {
                    empty++;
                }
            }
        }

        // remove nulls
        if (empty > this.callbacks.length / 2) {
            const newCallback = [];
            for (let i = 0; i < this.callbacks.length; i++) {
                this.callbacks[i] && newCallback.push(this.callbacks[i]);
            }
            this.callbacks = newCallback;
        }
    }

    withCallback (name: String, id: any, args: any, cb: any): void {
        if (name === 'authenticate') {
            this.authTimeout && clearTimeout(this.authTimeout);
            const gen = this.generation;
            this.authTimeout = setTimeout(() => {
                this.authTimeout = null;
                if (gen !== this.generation) {
                    return;
                }
                this.log.debug('Authenticate timeout');
                this.fire("error", 'Authenticate timeout');
                this.handleConnectionLoss("authenticate timeout");
            }, this.timeouts.authTimeoutMs);
        }
        this.callbacks.push({id, cb, ts: DEBUG ? 0 : Date.now() + 30000});
        if (!this.send(JSON.stringify([MESSAGE_TYPES.callback, id, name, args]))) {
            this.handleConnectionLoss(`cannot send '${name}'`);
        }
    }

    findAnswer(id: any, args: any): void {
        for (let i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i] && this.callbacks[i].id === id) {
                const cb = this.callbacks[i].cb;
                this.callbacks[i] = null;
                try {
                    cb.apply(null, args);
                } catch (e) {
                    this.log.error(`Callback for message ${id} threw: ${e}`);
                }
            }
        }
    }

    emit(name: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void {
        const allArgs = [arg1, arg2, arg3, arg4, arg5];
        if (!this.socket || !this.connected) {
            if (!this.wasConnected) {
                // cache all calls till connected
                this.pending.push({ name, args: allArgs });
            } else {
                this.log.warn(`Not connected. Dropping '${name}'`);
                const cb = [...allArgs].reverse().find(a => typeof a === 'function');
                cb && setTimeout(() => this.invokeSafely(cb, 'Not connected'), 0);
            }
            return;
        }

        this.id++;

        if (name === 'writeFile' && typeof arg3 !== 'string') {
            // _adapter, filename, data, callback
            // arg3 = arg3 && btoa(String.fromCharCode.apply(null, new Uint8Array(arg3)));
            throw Error("Not implemented yet");
        }

        if (typeof arg5 === 'function') {
            this.withCallback(name, this.id, [arg1, arg2, arg3, arg4], arg5);
        } else if (typeof arg4 === 'function') {
            this.withCallback(name, this.id, [arg1, arg2, arg3], arg4);
        } else if (typeof arg3 === 'function') {
            this.withCallback(name, this.id, [arg1, arg2], arg3);
        } else if (typeof arg2 === 'function') {
            this.withCallback(name, this.id, [arg1], arg2);
        } else if (typeof arg1 === 'function') {
            this.withCallback(name, this.id, [], arg1);
        } else {
            let payload: any[];
            if (arg1 === undefined && arg2 === undefined && arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                payload = [MESSAGE_TYPES.message, this.id, name];
            } else if (arg2 === undefined && arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                payload = [MESSAGE_TYPES.message, this.id, name, [arg1]];
            } else if (arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                payload = [MESSAGE_TYPES.message, this.id, name, [arg1, arg2]];
            } else if (arg4 === undefined && arg5 === undefined) {
                payload = [MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3]];
            } else if (arg5 === undefined) {
                payload = [MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4]];
            } else {
                payload = [MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4, arg5]];
            }
            if (!this.send(JSON.stringify(payload))) {
                this.handleConnectionLoss(`cannot send '${name}'`);
            }
        }
    }

    on(name: any, cb: any): void {
        if (cb) {
            this.handlers[name] = this.handlers[name] || [];

            if (this.handlers[name].includes(cb)) {
                return;
            }
            
            this.handlers[name].push(cb);
        }
    }

    off(name: any, cb?: any): void {
        if (this.handlers[name]) {
            const pos = this.handlers[name].indexOf(cb);
            if (pos !== -1) {
                this.handlers[name].splice(pos, 1);
                if (!this.handlers[name].length) {
                    delete this.handlers[name];
                }
            }
        }
    }

    reconnectNow(): void {
        if (this.connected || !this.url) {
            return;
        }
        this.startFastPhase(true);
        if (this.connectTimer || !this.socket) {
            this.clearConnectTimer();
            this.connect(this.url, this.options, this.allowSelfSignedCertificate).catch(e => {
                this.log.error(`Reconnect failed: ${e}`);
                this.scheduleReconnect();
            });
        }
        // Otherwise an attempt is already in flight.
    }

    close(): Promise<ISocketIoClient> {
        this.explicitlyClosed = true;
        this.clearConnectTimer();
        this.reconnectAttempt = 0;
        this.backoffAttempt = 0;
        this.fastPhaseStartedAt = undefined;
        this.pending = [];
        this.teardownSocket("closed by client", true);
        return Promise.resolve(this);
    }

    private handleConnectionLoss(reason: string): void {
        const wasEstablished = this.connected;
        this.teardownSocket(reason, true);
        if (this.autoReconnect && !this.explicitlyClosed) {
            if (wasEstablished) {
                this.startFastPhase(false);
            }
            this.scheduleReconnect();
        }
    }

    private startFastPhase(force: boolean): void {
        const now = Date.now();
        if (force || this.fastPhaseStartedAt === undefined || now - this.fastPhaseStartedAt >= FAST_RECONNECT_COOLDOWN_MS) {
            this.fastPhaseStartedAt = now;
            this.backoffAttempt = 0;
        }
    }

    /**
     * Synchronously detaches and closes the current socket. Safe to call any number of times.
     */
    private teardownSocket(reason: string, notify: boolean): void {
        this.pingInterval && clearInterval(this.pingInterval);
        this.pingInterval = null;

        this.authTimeout && clearTimeout(this.authTimeout);
        this.authTimeout = null;

        this.connectingTimer && clearTimeout(this.connectingTimer);
        this.connectingTimer = null;

        const ws = this.socket;
        this.socket = null;
        this.generation++;

        if (ws) {
            ws.onopen = null as any;
            ws.onclose = null as any;
            ws.onerror = null as any;
            ws.onmessage = null as any;
            // ws emits 'error' when a connecting socket is aborted; an EventEmitter without listener would throw.
            ws.on("error", noop);
            try {
                if (ws.readyState === WS_READY_STATE.connecting) {
                    ws.terminate();
                } else if (ws.readyState === WS_READY_STATE.open) {
                    ws.close();
                }
            } catch (e) {
                this.log.debug("Closing the websocket threw a exception: " + e);
            }
        }

        this.failPendingCallbacks(reason);

        if (this.connected) {
            this.connected = false;
            if (notify) {
                this.fire("connectionLost", reason);
                this.fire("disconnect");
            }
        }
    }

    private failPendingCallbacks(reason: string): void {
        const callbacks = this.callbacks;
        this.callbacks = [];
        callbacks.forEach((entry: any) => {
            if (entry && typeof entry.cb === 'function') {
                setTimeout(() => this.invokeSafely(entry.cb, `Connection lost: ${reason}`), 0);
            }
        });
    }

    private scheduleReconnect(): void {
        if (this.connectTimer) {
            this.log.debug('Reconnect is already scheduled');
            return;
        }
        this.reconnectAttempt++;
        const delay = isFastReconnectPhase(Date.now(), this.fastPhaseStartedAt, this.timeouts.fastReconnectWindowMs)
            ? this.timeouts.fastReconnectDelayMs
            : computeReconnectDelay(++this.backoffAttempt, this.timeouts.reconnectBaseDelayMs, this.timeouts.reconnectMaxDelayMs);
        this.log.debug(`Reconnect attempt ${this.reconnectAttempt} in ${delay} ms`);
        this.fire("reconnecting", this.reconnectAttempt, delay);
        this.connectTimer = setTimeout(() => {
            this.connectTimer = null;
            if (this.explicitlyClosed) {
                return;
            }
            this.connect(this.url, this.options, this.allowSelfSignedCertificate).catch(e => {
                this.log.error(`Reconnect failed: ${e}`);
                this.scheduleReconnect();
            });
        }, delay);
    }

    private clearConnectTimer(): void {
        this.connectTimer && clearTimeout(this.connectTimer);
        this.connectTimer = null;
    }

    private send(data: string): boolean {
        if (!this.socket || this.socket.readyState !== WS_READY_STATE.open) {
            return false;
        }
        try {
            this.socket.send(data);
            this.lastSent = Date.now();
            return true;
        } catch (e) {
            this.log.warn(`Cannot send: ${e}`);
            return false;
        }
    }

    private fire(name: string, ...args: any[]): void {
        const list = this.handlers[name];
        if (!list) {
            return;
        }
        [...list].forEach((cb: any) => {
            try {
                cb.apply(this, args);
            } catch (e) {
                this.log.error(`Handler for '${name}' threw: ${e}`);
            }
        });
    }

    private invokeSafely(cb: (...args: any[]) => void, ...args: any[]): void {
        try {
            cb(...args);
        } catch (e) {
            this.log.error(`Callback threw: ${e}`);
        }
    }
}
