import { Uri, window } from "vscode";

import { IConnectionEventListener } from "./IConnectionEventListener";
import { IConnectionService } from "./IConnectionService";
import { ILogMessage } from '../../models/ILogMessage';
import { ScriptId } from "../../models/ScriptId";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { ISocketIoClient } from "../socketIoClient/ISocketIoClient";

@injectable()
export class ConnectionServiceAdmin5 implements IConnectionService {
    public isConnected: boolean = false;

    private connectionTimeout = 10 * 1000;

    private connectionEventListeners: Array<IConnectionEventListener> = new Array();
    private client: ISocketIoClient | undefined = undefined;

    constructor(
        @inject(TYPES.services.socketIoClient) private socketIoClient: ISocketIoClient
    ) {}
    
    registerConnectionEventListener(listener: IConnectionEventListener): void {
        this.connectionEventListeners.push(listener);
    }
    
    async connect(uri: Uri, autoReconnect: boolean): Promise<void> {
        const message = window.setStatusBarMessage(`$(sync~spin) Connecting to ioBroker on '${uri}'`);

        if (this.client && this.client.connected) {
            await this.client.close();
            this.isConnected = false;
        }
        
        this.socketIoClient.autoReconnect = autoReconnect;
        this.client = await this.socketIoClient.connect(uri.toString(), {name: "vsCode"});

        return new Promise<void>((resolve, reject) => {
            this.registerSocketEvents();

            const timeout = setTimeout(() => {
                if (!this.isConnected) {
                    message.dispose();
                    reject(new Error(`Could not connect to '${uri}' after ${this.connectionTimeout / 1000} seconds.`));
                }
            }, this.connectionTimeout);

            this.client!.on("connect", () => {
                this.isConnected = true;
                message.dispose();
                resolve();
            });

            this.client!.on("reconnect", () => {
                this.isConnected = true;
                message.dispose();
                resolve();
            });

            this.client!.on("error", (err: any) => {
                message.dispose();
                clearTimeout(timeout);
                reject(new Error(`The connection to ioBroker was not possible. Reason: ${err}`));
            });
        });
    }

    async disconnect(): Promise<void> {
        await this.client?.close();
        return new Promise<void>((resolve) => {
            this.isConnected = false;

            this.client?.on("disconnect", () => {
                resolve();
            });
        });
    }
    
    registerForLogs(logAction: (logMessage: ILogMessage) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {

                this.client.on("log", (message: ILogMessage) => {
                    logAction(message);
                });
    
                this.client.emit("requireLog", true, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not register for logs: ${err}`));
                    } else {
                        resolve();
                    }                    
                });
            }
        });
    }

    unregisterForLogs(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {

                this.client.off("log");    
                this.client.emit("requireLog", false, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not unregister for logs: ${err}`));
                    } else {
                        resolve();
                    }
                });
            }
        });
    }

    registerForObjectChange(pattern: string, onChangeAction: (id: string, value: any) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {          
                this.client.on("objectChange", (id: string, value: any) => {
                    // TODO: This will be called for all registered patterns!
                    onChangeAction(id, value);
                });

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
                this.client.emit("getObjectView", "system", type,{"startkey": startKey,"endkey": `${endKey}\u9999`}, (err: any, doc: { rows: {id: string, value: TResult}[] }) => {
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

    private registerSocketEvents(): void {
        if (this.client) {
            this.client.on("connect", () => {
                this.isConnected = true;
                this.connectionEventListeners.forEach(listener => listener.onConnected());
            });

            this.client.on("reconnect", () => {
                this.isConnected = true;
                this.connectionEventListeners.forEach(listener => listener.onConnected());
            });
            
            this.client.on("disconnect", () => {
                this.isConnected = false;
                this.connectionEventListeners.forEach(listener => listener.onDisconnected());
            });
        }
    }
}
