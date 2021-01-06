import * as socketio from 'socket.io-client';

import { IConnectionService } from "./IConnectionService";
import { IConnectionEventListener } from "./IConnectionEventListener";

import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IScriptService } from '../script/IScriptService';
import { LogMessage } from '../../models/LogMessage';
import { IScriptChangedEventListener as IScriptChangedEventListener } from './IScriptChangedListener';
import { InvalidScript } from '../../models/InvalidScript';

@injectable()
export class ConnectionService implements IConnectionService {
    public isConnected: Boolean = false;

    private connectionTimeout = 10 * 1000;

    private connectionEventListeners: Array<IConnectionEventListener> = new Array();
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();
    private client: SocketIOClient.Socket | undefined = undefined;
    
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}

    registerConnectionEventListener(listener: IConnectionEventListener): void {
        this.connectionEventListeners.push(listener);
    }
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        this.scriptEventListeners.push(listener);
    }
    
    async connect(uri: Uri): Promise<void> {
        this.client = await new Promise<SocketIOClient.Socket>((resolve, reject) => {
            const localClient = socketio(uri.toString());

            localClient.on("connect", () => {
                this.isConnected = true;
                resolve(localClient);
            });

            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error(`Could not connect to '${uri}' after ${this.connectionTimeout / 1000} seconds.`));
                }
            }, this.connectionTimeout);
        });

        this.registerSocketEvents();
    }

    disconnect(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.client?.disconnect();

            this.client?.on("disconnect", () => {
                resolve();
            });
        });
    }

    downloadAllScripts(): Promise<ScriptObject[]> {
        return new Promise<ScriptObject[]>((resolve) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObjectView", "system","script",{"startkey":"script.js.","endkey":"script.js.\u9999"}, (err: any, doc: { rows: ScriptObject[]}) => {
                    resolve(doc.rows);
                });
            } else {
                resolve([]);
            }
        });
    }

    async downloadScriptWithUri(scriptUri: Uri): Promise<Script> {
        const scriptId = await this.scriptService.getIoBrokerId(scriptUri);
        return await this.downloadScriptWithId(scriptId);
    }

    downloadScriptWithId(scriptId: ScriptId): Promise<Script> {
        return new Promise<Script>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObject", scriptId, (err: any, script: Script) => {
                    if (err) {
                        reject(new Error(`Could not downlaod script with id '${scriptId}': ${err}`));
                    } else {
                        resolve(script);
                    }
                });
            } else {
                resolve(new InvalidScript());
            }
        });
    }

    uploadScript(script: Script): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {
                this.client.emit("setObject", script._id, script, (err: any) => {
                    if (err) {
                        reject(new Error(`Could not upload script with id '${script._id}': ${err}`));
                    } else {
                        resolve();
                    }
                });
            }
        });
    }

    startScript(scriptId: ScriptId): Promise<void> {
        return this.setScriptState(scriptId, true);
    }

    stopScript(scriptId: ScriptId): Promise<void> {
        return this.setScriptState(scriptId, false);
    }

    registerForLogs(logAction: (logMessage: LogMessage) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.client && this.isConnected) {

                this.client.on("log", (message: LogMessage) => {
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

            this.client.emit("subscribeObjects", "script.js.*");            
            this.client.on("objectChange", (id: string, value: any) => {
                this.scriptEventListeners.forEach(listener => listener.onScriptChanged(id, value));
            });
        }
    }

    private async setScriptState(scriptId: ScriptId, isEnabled: boolean): Promise<void> {
        if (this.client && this.isConnected) {
            const script: Script = {
                _id: scriptId,
                common: {
                    enabled: isEnabled
                }
            };

            const existingScript = await this.downloadScriptWithId(scriptId);
            if (existingScript) {
                this.client.emit("extendObject", scriptId, script, (err: any) => {
                    if (err) {
                        throw new Error(`Could set script state for '${scriptId}' to '${isEnabled}': ${err}`);
                    }
                });
            } else {
                throw new Error(`Could set script state for '${scriptId}' to '${isEnabled}', because it is not known to ioBroker`);
            }
        }
    }
}