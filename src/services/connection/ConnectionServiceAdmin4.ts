import * as socketio from 'socket.io-client';

import { Uri, window } from "vscode";

import { IConnectionEventListener } from "./IConnectionEventListener";
import { IConnectionService } from "./IConnectionService";
import { ILogMessage } from '../../models/ILogMessage';
import { ScriptId } from "../../models/ScriptId";
import { injectable } from "inversify";

@injectable()
export class ConnectionServiceAdmin4 implements IConnectionService {
    public isConnected: boolean = false;

    private connectionTimeout = 10 * 1000;

    private connectionEventListeners: Array<IConnectionEventListener> = new Array();
    private client: SocketIOClient.Socket | undefined = undefined;
    
    registerConnectionEventListener(listener: IConnectionEventListener): void {
        this.connectionEventListeners.push(listener);
    }
    
    async connect(uri: Uri): Promise<void> {
        const message = window.setStatusBarMessage(`$(sync~spin) Connecting to ioBroker on '${uri}'`);

        if (this.client && this.client.connected) {
            this.client.disconnect();
        }

        return new Promise<void>((resolve, reject) => {
            this.client = socketio(uri.toString());
            this.registerSocketEvents();

            this.client.on("connect", () => {
                this.isConnected = true;
                message.dispose();
                resolve();
            });

            setTimeout(() => {
                if (!this.isConnected) {
                    message.dispose();
                    reject(new Error(`Could not connect to '${uri}' after ${this.connectionTimeout / 1000} seconds.`));
                }
            }, this.connectionTimeout);
        });
    }

    disconnect(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.client?.disconnect();

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
            
            this.client.on("disconnect", () => {
                this.isConnected = false;
                this.connectionEventListeners.forEach(listener => listener.onDisconnected());
            });
        }
    }
}