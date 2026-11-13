/**
 * 
 * This is a type script compilable version of the client of the ioBroker admin adapter
 * from https://github.com/ioBroker/ioBroker.admin/blob/18aef11bd262c069dd9ba266950811d4c10931ae/src-rx/public/lib/js/socket.io.js
 * 
 */

import { ISocketIoClient } from "./ISocketIoClient";
import { inject, injectable } from "inversify";

import WebSocket = require("ws");
import TYPES from "../../Types";
import { IDebugLogService } from "../debugLogService/IDebugLogService";


// import btoa = require("btoa");

// const ERRORS = {
//     1000: 'CLOSE_NORMAL',	        // Successful operation / regular socket shutdown
//     1001: 'CLOSE_GOING_AWAY',	    // Client is leaving (browser tab closing)
//     1002: 'CLOSE_PROTOCOL_ERROR',	// Endpoint received a malformed frame
//     1003: 'CLOSE_UNSUPPORTED',		// Endpoint received an unsupported frame (e.g. binary-only endpoint received text frame)
//     1005: 'CLOSED_NO_STATUS',		// Expected close status, received none
//     1006: 'CLOSE_ABNORMAL',		    // No close code frame has been received
//     1007: 'Unsupported payload',	// Endpoint received inconsistent message (e.g. malformed UTF-8)
//     1008: 'Policy violation',	    // Generic code used for situations other than 1003 and 1009
//     1009: 'CLOSE_TOO_LARGE',	    // Endpoint won't process large frame
//     1010: 'Mandatory extension',	// Client wanted an extension which server did not negotiate
//     1011: 'Server error',	        // Internal server error while operating
//     1012: 'Service restart',	    // Server/service is restarting
//     1013: 'Try again later',	    // Temporary server condition forced blocking client's request
//     1014: 'Bad gateway	Server',    // acting as gateway received an invalid response
//     1015: 'TLS handshake fail',		// Transport Layer Security handshake failure
// };

const RECONNECT_TIMEOUT = 3000;
/** The admin websocket server drops a socket that has not sent anything for 15 seconds. */
const CLIENT_PING_INTERVAL = 5000;
const INBOUND_TIMEOUT = 15000;
/** Upper bound for closing a socket, so a dead peer cannot block a reconnect or the shutdown. */
const SOCKET_CLOSE_TIMEOUT = 2000;

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

@injectable()
export class SocketIoClient implements ISocketIoClient {

    private handlers: any = {};
    private lastReceived: any;
    private lastSent: any;
    private socket: WebSocket | null = null;
    private wasConnected = false;
    private connectTimer: any = null;
    private connectingTimer: any = null;
    private callbacks: any = [];
    private pending: any = []; // pending requests till connection established
    private url: String = "";
    private options: any;
    private allowSelfSignedCertificate: boolean = false;
    private pingInterval: any;
    private id = 0;
    private sessionID: any;
    private authTimeout: any = null;
    
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

    async connect(_url: any, _options: any, _allowSelfSignedCertificate: boolean): Promise<ISocketIoClient> {
        this.log.debug(`Try to connect to ${_url}`);
        this.id = 0;
        this.connectTimer && clearInterval(this.connectTimer);
        this.connectTimer = null;

        this.url = _url || this.url;
        this.options = _options || this.options;
        this.allowSelfSignedCertificate = _allowSelfSignedCertificate || this.allowSelfSignedCertificate;
        this.sessionID = Date.now();

        // The admin version detection uses this client as well. Its socket has to be closed before
        // the new one is created, otherwise its late close event tears down the new connection.
        await this.closeSocket(this.detachSocket());

        let socket: WebSocket;
        try {
            let u = this.url.replace(/^http/, 'ws').split('?')[0] + '?sid=' + this.sessionID;
            if (_options && _options.name) {
                u += '&name=' + encodeURIComponent(_options.name);
            }
            if (_options.cookie) {
                this.debugLogService.log(`Created websocket with authorization. AllowSelfSignedCertificate: ${this.allowSelfSignedCertificate}. Cooke set: ${_options.cookie ? "yes": "no"}`, "SocketIoClient");
                socket = new WebSocket(u, {
                    rejectUnauthorized: !_allowSelfSignedCertificate,
                    headers: { "cookie": _options.cookie}
                });                
            }
            else {
                this.debugLogService.log(`Created websocket without authorization. AllowSelfSignedCertificate: ${this.allowSelfSignedCertificate}. Cooke set: ${_options.cookie ? "yes": "no"}`, "SocketIoClient");
                // "ws://www.example.com/socketserver"
                socket = new WebSocket(u, {
                    rejectUnauthorized: !_allowSelfSignedCertificate
                });
            }
        } catch (error) {
            this.debugLogService.logError(`Exception while creating websocket: ${error}`, "SocketIoClient");
            this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, error));
            return await this.closeAndReconnect();
        }

        this.socket = socket;
        // Events of a socket that was replaced in the meantime must not touch the current one.
        const isCurrent = (): boolean => socket === this.socket;

        this.connectingTimer = setTimeout(async () => {
            this.connectingTimer = null;
            if (!isCurrent()) {
                return;
            }
            this.log.warn('No READY flag received in 3 seconds. Re-init');
            await this.closeAndReconnect(); // re-init connection, because no ___ready___ received in 3000 ms
        }, 3000);

        socket.onopen = () => {
            if (!isCurrent()) {
                return;
            }
            this.lastReceived = Date.now();
            this.lastSent = Date.now();

            this.pingInterval = setInterval(() => this.checkHeartbeat(), CLIENT_PING_INTERVAL);
        };

        socket.onclose = async (event: {code: Number}) => {
            if (!isCurrent()) {
                return;
            }

            if (event.code === 3001) {
                this.log.warn('ws closed');
            } else {
                // this.log.error('ws connection error: ' + ERRORS[event.code]);
                this.log.error('ws connection error: ' + event.code);
            }

            if (this.autoReconnect) {
                await this.closeAndReconnect();                
            }
            else {
                await this.close();
            }
        };

        socket.onerror = async (error: any) => {
            if (!isCurrent()) {
                return;
            }

            if (this.connected) {
                if (socket.readyState === WS_READY_STATE.open) {
                    this.log.error('ws normal error: ' + error.message);
                }
            }
            
            this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, `Error Code: ${error.code || 'UNKNOWN'}; Message: ${error.message}`));

            if (this.autoReconnect) {
                await this.closeAndReconnect();                
            }
            else {
                await this.close();
            }
        };

        socket.onmessage = (message: any) => {
            if (!isCurrent()) {
                return;
            }
            this.log.debug(`type: ${message?.type}, data: ${message?.data}`);
            this.lastReceived = Date.now();
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
            } else
            if (type === MESSAGE_TYPES.message) {
                if (name === '___ready___') {
                    this.connected  = true;

                    if (this.wasConnected) {
                        this.handlers.reconnect && this.handlers.reconnect.forEach((cb: any) => cb.call(this, true));
                    } else {
                        this.handlers.connect && this.handlers.connect.forEach((cb: any) => cb.call(this, true));
                        this.wasConnected = true;
                    }

                    this.connectingTimer && clearTimeout(this.connectingTimer);
                    this.connectingTimer = null;

                    // resend all pending requests
                    if (this.pending.length) {
                        this.pending.forEach((p: any) =>
                            this.emit(p.name, p.arg1, p.arg2, p.arg3, p.arg4, p.arg5));

                        this.pending = [];
                    }

                } else if (args) {
                    this.handlers[name] && this.handlers[name].forEach((cb: any) => cb.call(this, args[0], args[1], args[2], args[3], args[4]));
                } else {
                    this.handlers[name] && this.handlers[name].forEach((cb: any) => cb.call(this));
                }
            } else if (type === MESSAGE_TYPES.ping) {
                if (this.socket) {
                    this.send([MESSAGE_TYPES.pong]);
                }
            } else if (type === MESSAGE_TYPES.pong) {
                // lastReceived is updated for every message, a pong needs no extra handling.
            } else {
                this.log.warn('Received unknown message type: ' + type);
            }
        };

        return this;
    }

    /**
     * The admin websocket server closes a socket that has not sent anything for 15 seconds, so the
     * client has to ping on its own. Using the last received message as the trigger - like the
     * original implementation did - never sent a ping against a chatty server, which then dropped
     * the socket with close code 1005.
     */
    private checkHeartbeat(): void {
        const now = Date.now();

        if (now - this.lastReceived > INBOUND_TIMEOUT) {
            this.log.warn(`No message from ioBroker for ${INBOUND_TIMEOUT / 1000} seconds. Re-init`);
            this.closeAndReconnect();
            return;
        }

        if (now - this.lastSent >= CLIENT_PING_INTERVAL) {
            try {
                this.send([MESSAGE_TYPES.ping]);
            } catch (e) {
                this.log.warn('Cannot send ping. Close connection: ' + e);
                this.closeAndReconnect();
                return;
            }
        }

        this._garbageCollect();
    }

    private send(payload: any[]): void {
        if (!this.socket) {
            throw new Error('There is no open websocket.');
        }

        this.socket.send(JSON.stringify(payload));
        this.lastSent = Date.now();
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
            this.authTimeout = setTimeout(() => {
                this.authTimeout = null;
                if (this.connected) {
                    this.log.debug('Authenticate timeout');
                    this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, 'Authenticate timeout'));
                }
                this.closeAndReconnect();
            }, 2000);
        }
        this.callbacks.push({id, cb, ts: DEBUG ? 0 : Date.now() + 30000});
        if (this.socket) {
            this.send([MESSAGE_TYPES.callback, id, name, args]);
        }
    }

    findAnswer(id: any, args: any): void {
        for (let i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i] && this.callbacks[i].id === id) {
                const cb = this.callbacks[i].cb;
                cb.apply(null, args);
                this.callbacks[i] = null;
            }
        }
    }

    emit(name: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void {
        if (!this.socket || !this.connected) {
            if (!this.wasConnected) {
                // cache all calls till connected
                this.pending.push([name, arg1, arg2, arg3, arg4, arg5]);
            } else {
                this.log.warn('Not connected');
            }
            return;
        }

        this.id++;

        if (name === 'writeFile' && typeof arg3 !== 'string') {
            // _adapter, filename, data, callback
            // arg3 = arg3 && btoa(String.fromCharCode.apply(null, new Uint8Array(arg3)));
            throw Error("Not implemented yet");
        }

        try {
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
            } else
            if (arg1 === undefined && arg2 === undefined && arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                this.send([MESSAGE_TYPES.message, this.id, name]);
            } else if (arg2 === undefined && arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                this.send([MESSAGE_TYPES.message, this.id, name, [arg1]]);
            } else if (arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                this.send([MESSAGE_TYPES.message, this.id, name, [arg1, arg2]]);
            } else if (arg4 === undefined && arg5 === undefined) {
                this.send([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3]]);
            } else if (arg5 === undefined) {
                this.send([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4]]);
            } else {
                this.send([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4, arg5]]);
            }
        } catch (e) {
            this.log.error('Cannot send: ' + e);
            this.closeAndReconnect();
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

    close(): Promise<ISocketIoClient> {
        const wasConnected = this.connected;
        const socket = this.detachSocket();

        // The handlers deliberately survive: they belong to the caller and have to stay registered
        // across a reconnect. Clearing them made every internal reconnect invisible, so the
        // connection service kept reporting a dead connection after the socket was back.
        if (wasConnected) {
            this.handlers.disconnect && this.handlers.disconnect.forEach((cb: any) => cb.call(this));
        }

        return this.closeSocket(socket);
    }

    /**
     * Stops the timers, forgets the socket and fails the pending requests. The registered handlers
     * stay, so a reconnect or a later connect still reaches them.
     */
    private detachSocket(): WebSocket | null {
        this.pingInterval && clearTimeout(this.pingInterval);
        this.pingInterval = null;

        this.authTimeout && clearTimeout(this.authTimeout);
        this.authTimeout = null;

        this.connectingTimer && clearTimeout(this.connectingTimer);
        this.connectingTimer = null;

        // A scheduled reconnect would bring the socket back after an intentional close.
        this.connectTimer && clearTimeout(this.connectTimer);
        this.connectTimer = null;

        const socket = this.socket;
        this.socket = null;
        this.connected = false;

        // Requests that wait for an answer would otherwise hang until the caller gives up.
        this.failPendingRequests("The connection to ioBroker was closed.");

        return socket;
    }

    /** Closes a socket that is no longer tracked, without running its reconnect handler. */
    private closeSocket(socket: WebSocket | null): Promise<ISocketIoClient> {
        if (!socket || socket.readyState === WS_READY_STATE.closed) {
            return Promise.resolve(this);
        }

        return new Promise<ISocketIoClient>((resolve) => {
            const settled = () => {
                clearTimeout(closeTimeout);
                resolve(this);
            };
            const closeTimeout = setTimeout(() => {
                try {
                    socket.terminate();
                } catch (e) {
                    this.log.debug("Terminating the websocket threw a exception: " + e);
                }
                settled();
            }, SOCKET_CLOSE_TIMEOUT);

            socket.onmessage = () => undefined;
            socket.onerror = () => undefined;
            socket.onclose = settled;

            try {
                socket.close();
            } catch (e) {
                this.log.debug("Closing the websocket threw a exception: " + e);
                settled();
            }
        });
    }

    /** Rejects every request that still waits for an answer, so a dropped socket fails fast. */
    private failPendingRequests(reason: string): void {
        const callbacks = this.callbacks;
        this.callbacks = [];
        for (const callback of callbacks) {
            callback?.cb?.(reason);
        }
    }

    _reconnect(): void {
        if (!this.connectTimer) {
            this.log.debug('Start reconnect');
            this.connectTimer = setTimeout(() => {
                this.connectTimer = null;
                this.connect(this.url, this.options, this.allowSelfSignedCertificate);
            }, RECONNECT_TIMEOUT);
        } else {
            this.log.debug('Reconnect is already running');
        }
    }

    private async closeAndReconnect(): Promise<ISocketIoClient> {
        await this.close();
        this._reconnect();
        return this;
    }
}