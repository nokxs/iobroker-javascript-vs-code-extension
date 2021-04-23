/*!
 * ioBroker WebSockets
 * Copyright 2020-2021, bluefox <dogafox@gmail.com>
 * Released under the MIT License.
 * v 0.2.1 (2020_10_16)
 */
/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint -W061 */
'use strict';

import { ISocketIoClient } from "./ISocketIoClient";
import { injectable } from "inversify";

import WebSocket = require("ws");

// import btoa = require("btoa");

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
    private socket: any;
    private wasConnected = false;
    private connectTimer: any = null;
    private connectingTimer: any = null;
    private connectionCount = 0;
    private callbacks: any = [];
    private pending: any = []; // pending requests till connection established
    private url: String = "";
    private options: any;
    private pingInterval: any;
    private id = 0;
    private sessionID: any;
    private authTimeout: any = null;
    
    public connected = false;

    log = {
        debug: (text: String) => DEBUG && console.log(`[${new Date().toISOString()}] ${text}`),
        warn:  (text: String) => console.warn(`[${new Date().toISOString()}] ${text}`),
        error: (text: String) => console.error(`[${new Date().toISOString()}] ${text}`),
    };

    constructor() {
        this.connected = false; // simulate socket.io interface
    }

    connect(_url: any, _options: any): ISocketIoClient {
        this.log.debug('Try to connect');
        this.id = 0;
        this.connectTimer && clearInterval(this.connectTimer);
        this.connectTimer = null;

        this.url = this.url || _url;
        this.options = this.options || _options;
        this.sessionID = Date.now();
        try {
            let u = this.url.replace(/^http/, 'ws').split('?')[0] + '?sid=' + this.sessionID;
            if (_options && _options.name) {
                u += '&name=' + encodeURIComponent(_options.name);
            }
            // "ws://www.example.com/socketserver"
            this.socket = new WebSocket(u);
        } catch (error) {
            this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, error));
            return this.close();
        }

        this.connectingTimer = setTimeout(() => {
            this.connectingTimer = null;
            this.log.warn('No READY flag received in 3 seconds. Re-init');
            this.close(); // re-init connection, because no ___ready___ received in 2000 ms
        }, 3000);

        this.socket.onopen = () => {
            this.lastPong = Date.now();
            this.connectionCount = 0;

            this.pingInterval = setInterval(() => {
                if (Date.now() - this.lastPong > 5000) {
                    try {
                        this.socket.send(JSON.stringify([MESSAGE_TYPES.ping]));
                    } catch (e) {
                        this.log.warn('Cannot send ping. Close connection: ' + e);
                        this.close();
                        return this._garbageCollect();
                    }
                }
                if (Date.now() - this.lastPong > 15000) {
                    this.close();
                }
                this._garbageCollect();
            }, 5000);
        };

        this.socket.onclose = (event: {code: Number}) => {
            if (event.code === 3001) {
                this.log.warn('ws closed');
            } else {
                // this.log.error('ws connection error: ' + ERRORS[event.code]);
                this.log.error('ws connection error: ' + event.code);
            }
            this.close();
        };

        this.socket.onerror = (error: any) => {
            if (this.connected) {
                if (this.socket.readyState === 1) {
                    this.log.error('ws normal error: ' + error.type);
                }
            }
            
            this.handlers.error && this.handlers.error.forEach((cb: any) => cb.call(this, error.code || 'UNKNOWN'));
            this.close();
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
                this.socket.send(JSON.stringify([MESSAGE_TYPES.pong]));
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
                this.close();
            }, 2000);
        }
        this.callbacks.push({id, cb, ts: DEBUG ? 0 : Date.now() + 30000});
        this.socket.send(JSON.stringify([MESSAGE_TYPES.callback, id, name, args]));
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
            this.close();
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

    close(): ISocketIoClient {
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
            this.socket = null;
        }

        if (this.connected) {
            this.handlers.disconnect && this.handlers.disconnect.forEach((cb: any) => cb.call(this));
            this.connected = false;
        }

        this.callbacks = [];

        this._reconnect();
        return this;
    }

    _reconnect(): void {
        if (!this.connectTimer) {
            this.log.debug('Start reconnect ' + this.connectionCount);
            this.connectTimer = setTimeout(() => {
                this.connectTimer = null;
                if (this.connectionCount < 5) {
                    this.connectionCount++;
                }
                this.connect(this.url, this.options);
            }, this.connectionCount * 1000);
        } else {
            this.log.debug('Reconnect is already running ' + this.connectionCount);
        }
    }
}