import { Uri, window } from "vscode";

import { IConnectionEventListener } from "./IConnectionEventListener";
import { IConnectionService } from "./IConnectionService";
import { ILogMessage } from '../../models/ILogMessage';
import { ScriptId } from "../../models/ScriptId";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { ISocketIoClient } from "../socketIoClient/ISocketIoClient";
import { IState } from "../../models/IState";
import { IObjectList } from "../../models/IObjectList";
import { HOST_COMMAND_TIMEOUT_MS, readLogLinesAnswer } from "./hostCommandAnswer";
import { ConnectionTimeouts, DEFAULT_CONNECTION_TIMEOUTS } from "../socketIoClient/ConnectionTimeouts";

@injectable()
export class ConnectionServiceAdmin5 implements IConnectionService {
    public isConnected: boolean = false;

    private timeouts: ConnectionTimeouts = { ...DEFAULT_CONNECTION_TIMEOUTS };

    private connectionEventListeners: Array<IConnectionEventListener> = new Array();
    private client: ISocketIoClient | undefined = undefined;
    private socketEventsRegistered = false;
    /** Server-side subscriptions belong to one websocket session and must be renewed after a reconnect. */
    private readonly logCallbacks = new Set<(logMessage: ILogMessage) => void>();
    private readonly objectChangeHandlers = new Map<string, (id: string, value: any) => void>();

    constructor(
        @inject(TYPES.services.socketIoClient) private socketIoClient: ISocketIoClient
    ) { }

    configureTimeouts(timeouts: ConnectionTimeouts): void {
        this.timeouts = { ...timeouts };
    }

    reconnectNow(): Promise<boolean> {
        if (this.isConnected) {
            return Promise.resolve(true);
        }
        if (!this.client) {
            return Promise.resolve(false);
        }

        const client = this.client;
        return new Promise<boolean>((resolve) => {
            const finish = (result: boolean) => {
                clearTimeout(timeout);
                client.off("connect", onConnected);
                client.off("reconnect", onConnected);
                resolve(result);
            };
            const onConnected = () => finish(true);
            const timeout = setTimeout(() => finish(this.isConnected), this.timeouts.connectionTimeoutMs);

            client.on("connect", onConnected);
            client.on("reconnect", onConnected);
            client.reconnectNow();
        });
    }

    registerConnectionEventListener(listener: IConnectionEventListener): void {
        if (this.connectionEventListeners.includes(listener)) {
            return; 
        }
        
        this.connectionEventListeners.push(listener);
    }

    async connect(uri: Uri, autoReconnect: boolean, allowSelfSignedCertificate: boolean): Promise<void> {
        const options = {};
        await this.connectInternal(uri, autoReconnect, allowSelfSignedCertificate, options);
    }

    async connectWithToken(uri: Uri, autoReconnect: boolean, allowSelfSignedCertificate: boolean, accessToken: string, username: string | null): Promise<void> {
        const options = {cookie: accessToken, name: username};        
        await this.connectInternal(uri, autoReconnect, allowSelfSignedCertificate, options);
    }

    async disconnect(): Promise<void> {
        await this.client?.close();
        this.isConnected = false;
    }

    registerForLogs(logAction: (logMessage: ILogMessage) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.logCallbacks.add(logAction);
            this.socketIoClient.on("log", logAction);

            if (this.client && this.isConnected) {
                this.client.emit("requireLog", true, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not register for logs: ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                // Subscribed on the server as soon as the connection is (re-)established.
                resolve();
            }
        });
    }

    unregisterForLogs(logAction: (logMessage: ILogMessage) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.logCallbacks.delete(logAction);
            this.socketIoClient.off("log", logAction);

            if (this.client && this.isConnected) {
                this.client.emit("requireLog", false, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not unregister for logs: ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    registerForObjectChange(pattern: string, onChangeAction: (id: string, value: any) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {
                const previous = this.objectChangeHandlers.get(pattern);
                if (previous) {
                    this.client.off("objectChange", previous);
                }

                // https://stackoverflow.com/questions/52143451/javascript-filter-with-wildcard
                const regex = new RegExp('^' + pattern.replace(".", "\\.").replace(/\*/g, '.*') + '$');
                const handler = (id: string, value: any) => {
                    if (regex.test(id)) {
                        onChangeAction(id, value);
                    }
                };
                this.objectChangeHandlers.set(pattern, handler);
                this.client.on("objectChange", handler);

                this.client.emit("subscribeObjects", pattern, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not subscribe for pattern '${pattern}': ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                reject(new Error(`Could not subscribe for pattern '${pattern}': Client is not connect`));
            }
        });
    }

    unregisterObjectChange(pattern: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const handler = this.objectChangeHandlers.get(pattern);
            if (handler) {
                this.socketIoClient.off("objectChange", handler);
                this.objectChangeHandlers.delete(pattern);
            }

            if (this.client && this.isConnected) {
                this.client.emit("unsubscribeObjects", pattern, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not unsubscribe for pattern '${pattern}': ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    getAllObjects(): Promise<IObjectList> {
        return new Promise<IObjectList>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("getAllObjects", (err: any, objects: IObjectList) => {
                    if (err) {
                        reject(new Error(`Could not get all object: ${err}`));
                    } else {
                        resolve(objects);
                    }
                });
            } else {
                reject(new Error(`Could not get all objects: Client is not connect`));
            }
        });
    }

    getObject<TObject>(objectId: string | ScriptId): Promise<TObject> {
        return new Promise<TObject>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObject", objectId, (err: any, script: TObject) => {
                    if (err) {
                        reject(new Error(`Could not get object with args '${objectId}': ${err}`));
                    } else {
                        resolve(script);
                    }
                });
            } else {
                reject(new Error(`Could not get object with id '${objectId}': Client is not connect`));
            }
        });
    }

    setObject(objectId: string | ScriptId, obj: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("setObject", objectId, obj, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not upload script with id '${objectId}': ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                reject(new Error(`Cannot get object with id '${objectId}': Client is not connect`));
            }
        });
    }

    deleteObject(objectId: string | ScriptId): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("delObject", objectId, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not delete object '${objectId}': ${err}`));
                    } else {
                        resolve();
                    }
                });
            } else {
                reject(`Could not delete object '${objectId}': Client is not connected`);
            }
        });
    }

    extendObject(objectId: string | ScriptId, obj: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("extendObject", objectId, obj, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not extend object '${objectId}' with '${JSON.stringify(obj)}'`));
                    } else {
                        resolve();
                    }
                });
            }
        });
    }

    getSystemObjectView<TResult>(type: string, startKey: string, endKey: string): Promise<TResult[]> {
        return new Promise<TResult[]>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObjectView", "system", type, { "startkey": startKey, "endkey": `${endKey}\u9999` }, (err: any, doc: { rows: { id: string, value: TResult }[] }) => {
                    if (err) {
                        reject(new Error(`Error while retreiving object view: Type: ${type} | startKey: ${startKey} | endKey: ${endKey}`));
                    }
                    resolve(doc.rows.map(row => row.value));
                });
            } else {
                reject(`Error while retreiving object view: Type: ${type} | startKey: ${startKey} | endKey: ${endKey}`);
            }
        });
    }

    getState(id: string): Promise<IState> {
        return new Promise<IState>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("getState", id, (err: any, state: IState) => {
                    if (err) {
                        reject(new Error(`Could not get state with id '${id}': ${err}`));
                    } else {
                        resolve(state);
                    }
                });
            } else {
                reject(new Error(`Could not get state with id '${id}': Client is not connect`));
            }
        });
    }

    getLogs(hostId: string, lines: number): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            const client = this.client;
            if (!client || !this.isConnected) {
                reject(new Error("Could not get logs: Client is not connected."));
                return;
            }

            let settled = false;
            // A host in a multihost setup can be unreachable, and then the command is never answered.
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }

                settled = true;
                reject(new Error(`Could not get logs from host '${hostId}': The host did not answer within ${HOST_COMMAND_TIMEOUT_MS / 1000} seconds.`));
            }, HOST_COMMAND_TIMEOUT_MS);

            const onAnswer = (response: unknown) => {
                if (settled) {
                    return;
                }

                settled = true;
                clearTimeout(timeout);

                const answer = readLogLinesAnswer(response);
                if ("error" in answer) {
                    reject(new Error(`Could not get logs from host '${hostId}': ${answer.error}`));
                } else {
                    resolve(answer.lines);
                }
            };

            try {
                client.emit("sendToHost", hostId.replace(/^system\.host\./, ""), "getLogs", lines, onAnswer);
            } catch (error) {
                settled = true;
                clearTimeout(timeout);
                reject(error instanceof Error ? error : new Error(`Could not get logs from host '${hostId}': ${error}`));
            }
        });
    }

    private registerSocketEvents(): void {
        if (this.socketEventsRegistered) {
            return;
        }
        this.socketEventsRegistered = true;
        const client = this.socketIoClient;

        client.on("connect", () => {
            this.isConnected = true;
            this.connectionEventListeners.forEach(listener => listener.onConnected());
        });

        client.on("reconnect", (_: boolean, attempts?: number) => {
            this.isConnected = true;
            this.renewLogSubscription();
            this.connectionEventListeners.forEach(listener => listener.onConnected(attempts ?? 0));
        });

        client.on("connectionLost", (reason: string) => {
            this.connectionEventListeners.forEach(listener => listener.onConnectionLost?.(reason));
        });

        client.on("disconnect", () => {
            this.isConnected = false;
            this.connectionEventListeners.forEach(listener => listener.onDisconnected());
        });

        client.on("reconnecting", (attempt: number, delayMs: number) => {
            this.connectionEventListeners.forEach(listener => listener.onReconnecting?.(attempt, delayMs));
        });

        client.on("reauthenticate", () => {
            this.isConnected = false;
            this.connectionEventListeners.forEach(listener => listener.onReAuthenticate());
        });
    }

    private renewLogSubscription(): void {
        if (this.logCallbacks.size === 0) {
            return;
        }
        this.socketIoClient.emit("requireLog", true, (err: any) => {
            if (err) {
                window.showWarningMessage(`ioBroker: could not renew log subscription after reconnect: ${err}`);
            }
        });
    }

    private async connectInternal(uri: Uri, autoReconnect: boolean, allowSelfSignedCertificate: boolean, options: any): Promise<void> {
        const message = window.setStatusBarMessage(`$(sync~spin) Connecting to ioBroker on '${uri}'`);

        if (this.client) {
            // Also stops a reconnect loop that may still be running from a previous connection.
            await this.client.close();
            this.isConnected = false;
        }

        this.registerSocketEvents();
        this.socketIoClient.autoReconnect = autoReconnect;
        this.socketIoClient.configure(this.timeouts);

        const client = this.socketIoClient;
        const connectionTimeoutMs = this.timeouts.connectionTimeoutMs;

        const connectionPromise = new Promise<void>((resolve, reject) => {
            let lastError: string | undefined;

            const cleanup = () => {
                clearTimeout(timeout);
                message.dispose();
                client.off("connect", onConnected);
                client.off("reconnect", onConnected);
                client.off("error", onError);
            };

            const onConnected = () => {
                this.isConnected = true;
                cleanup();
                resolve();
            };

            const onError = (err: any) => {
                lastError = `${err}`;
                if (!autoReconnect) {
                    cleanup();
                    reject(new Error(`The connection to ioBroker was not possible. Reason: ${err}`));
                }
                // With auto reconnect the client retries on its own; only the overall timeout fails the connect.
            };

            const timeout = setTimeout(() => {
                if (this.isConnected) {
                    return;
                }
                cleanup();
                const reason = lastError ? ` Last error: ${lastError}.` : "";
                const retry = autoReconnect ? " Still retrying in the background." : "";
                reject(new Error(`Could not connect to '${uri}' after ${connectionTimeoutMs / 1000} seconds.${reason}${retry}`));
            }, connectionTimeoutMs);

            client.on("connect", onConnected);
            client.on("reconnect", onConnected);
            client.on("error", onError);
        });

        this.client = await client.connect(uri.toString(), options, allowSelfSignedCertificate);

        return connectionPromise;
    }
}

