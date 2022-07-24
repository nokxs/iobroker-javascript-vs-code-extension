/**
 * 
 * This is a type script compilable version of the client of the ioBroker admin adapter
 * from https://github.com/ioBroker/ioBroker.admin/blob/18aef11bd262c069dd9ba266950811d4c10931ae/src-rx/public/lib/js/socket.io.js
 * 
 */

import { ISocketIoClient } from "./ISocketIoClient";
import { injectable } from "inversify";

import WebSocket = require("ws");


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
    private lastPong: any;
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
        debug: (text: String) => DEBUG && console.log(`[${new Date().toISOString()}] ${text}`),
        warn:  (text: String) => console.warn(`[${new Date().toISOString()}] ${text}`),
        error: (text: String) => console.error(`[${new Date().toISOString()}] ${text}`),
    };

    constructor() {
        this.connected = false; // simulate socket.io interface
    }

    async connect(_url: any, _options: any, _allowSelfSignedCertificate: boolean): Promise<ISocketIoClient> {
        this.log.debug('Try to connect');
        this.id = 0;
        this.connectTimer && clearInterval(this.connectTimer);
        this.connectTimer = null;

        this.url = this.url || _url;
        this.options = this.options || _options;
        this.allowSelfSignedCertificate = this.allowSelfSignedCertificate || _allowSelfSignedCertificate;
        this.sessionID = Date.now();
        try {
            let u = this.url.replace(/^http/, 'ws').split('?')[0] + '?sid=' + this.sessionID;
            if (_options && _options.name) {
                u += '&name=' + encodeURIComponent(_options.name);
            }
            if (_options.cookie) {
                this.socket = new WebSocket(u, {
                    rejectUnauthorized: !_allowSelfSignedCertificate,
                    headers: { "cookie": _options.cookie}
                });
            }
            else {
                // "ws://www.example.com/socketserver"
                this.socket = new WebSocket(u, {
                    rejectUnauthorized: !_allowSelfSignedCertificate
                });
            }
        } catch (error) {
            this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, error));
            return await this.closeAndReconnect();
        }

        this.connectingTimer = setTimeout(async () => {
            this.connectingTimer = null;
            this.log.warn('No READY flag received in 3 seconds. Re-init');
            await this.closeAndReconnect(); // re-init connection, because no ___ready___ received in 3000 ms
        }, 3000);

        this.socket.onopen = () => {
            this.lastPong = Date.now();

            this.pingInterval = setInterval(async () => {
                if (Date.now() - this.lastPong > 5000) {
                    try {
                        this.socket?.send(JSON.stringify([MESSAGE_TYPES.ping]));
                    } catch (e) {
                        this.log.warn('Cannot send ping. Close connection: ' + e);
                        await this.closeAndReconnect();
                        return this._garbageCollect();
                    }
                }

                if (Date.now() - this.lastPong > 15000) {
                    await this.closeAndReconnect();
                }
                this._garbageCollect();
            }, 5000);
        };

        this.socket.onclose = async (event: {code: Number}) => {
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

        this.socket.onerror = async (error: any) => {
            if (this.connected) {
                if (this.socket?.readyState === WS_READY_STATE.open) {
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

        this.socket.onmessage = (message: any) => {
            this.lastPong = Date.now();
            if (!message || !message.data || typeof message.data !== 'string') {
                return console.error('Received invalid message: ' + JSON.stringify(message));
            }
            let data;
            try {
                data = JSON.parse(message.data);
            } catch (e) {
                return console.error('Received invalid message: ' + JSON.stringify(message.data));
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
                this.socket?.send(JSON.stringify([MESSAGE_TYPES.pong]));
            } else if (type === MESSAGE_TYPES.pong) {
                // lastPong saved
            } else {
                this.log.warn('Received unknown message type: ' + type);
            }
        };

        return this;
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
        this.socket?.send(JSON.stringify([MESSAGE_TYPES.callback, id, name, args]));
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
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name]));
            } else if (arg2 === undefined && arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name, [arg1]]));
            } else if (arg3 === undefined && arg4 === undefined && arg5 === undefined) {
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name, [arg1, arg2]]));
            } else if (arg4 === undefined && arg5 === undefined) {
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3]]));
            } else if (arg5 === undefined) {
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4]]));
            } else {
                this.socket.send(JSON.stringify([MESSAGE_TYPES.message, this.id, name, [arg1, arg2, arg3, arg4, arg5]]));
            }
        } catch (e) {
            console.error('Cannot send: ' + e);
            this.closeAndReconnect();
        }
    }

    on(name: any, cb: any): void {
        if (cb) {
            this.handlers[name] = this.handlers[name] || [];
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
        this.pingInterval && clearTimeout(this.pingInterval);
        this.pingInterval = null;

        this.authTimeout && clearTimeout(this.authTimeout);
        this.authTimeout = null;

        this.connectingTimer && clearTimeout(this.connectingTimer);
        this.connectingTimer = null;

        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                this.log.debug("Closing the websocket threw a exception: " + e);
            }
        }

        if (this.connected) {
            this.handlers.disconnect && this.handlers.disconnect.forEach((cb: any) => cb.call(this));
            this.connected = false;
        }

        this.callbacks = [];
        const client = this;
        return new Promise<ISocketIoClient>((resolve) => {
            if (this.socket?.readyState === WS_READY_STATE.closed) {
                resolve(client);
                return;
            } 

            this.socket!.onclose = () => {  
                this.socket = null;            
                resolve(client);
            };
        });
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