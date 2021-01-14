import * as socketio from 'socket.io-client';

import { IConnectionService } from "./IConnectionService";
import { IConnectionEventListener } from "./IConnectionEventListener";

import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import { Uri, window } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { LogMessage } from '../../models/LogMessage';
import { IScriptChangedEventListener as IScriptChangedEventListener } from './IScriptChangedListener';
import { InvalidScript } from '../../models/InvalidScript';
import { IScriptIdService } from '../scriptId/IScriptIdService';

@injectable()
export class ConnectionService implements IConnectionService {
    public isConnected: Boolean = false;

    private connectionTimeout = 10 * 1000;

    private connectionEventListeners: Array<IConnectionEventListener> = new Array();
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();
    private client: SocketIOClient.Socket | undefined = undefined;
    
    constructor(
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
    ) {}

    registerConnectionEventListener(listener: IConnectionEventListener): void {
        this.connectionEventListeners.push(listener);
    }
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        this.scriptEventListeners.push(listener);
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
        const scriptId = this.scriptIdService.getIoBrokerId(scriptUri);
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
                // TODO: use private methods
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

    async rename(scriptId: ScriptId, name: string): Promise<void> {
        const splittedId = scriptId.split(".");
        let sanatizedName = this.replaceAll(name, " ", "_");
        sanatizedName = this.replaceAll(sanatizedName, ".", "_");

        splittedId.splice(-1,1);
        splittedId.push(sanatizedName);
        const newId = splittedId.join(".");

        const script = await this.downloadScriptWithId(scriptId);
        script._id = newId;
        script.common.name = name;

        await this.deleteScript(scriptId);
        await this.createScript(script);
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

    async updateScript(scriptId: ScriptId, script: Script): Promise<void> {
        if (this.client && this.isConnected) {
            const existingScript = await this.downloadScriptWithId(scriptId);
            if (existingScript) {
                this.client.emit("extendObject", scriptId, script, (err: any) => {
                    if (err) {
                        throw new Error(`Could not update script '${scriptId}' to '${JSON.stringify(script)}': ${err}`);
                    }
                });
            } else {
                throw new Error(`Could not update script '${scriptId}', because it is not known to ioBroker`);
            }
        }
    }

    async deleteScript(scriptId: ScriptId): Promise<void> {
        if (this.client && this.isConnected) {
            this.client.emit("delObject", scriptId, (err: any) => {
                if (err) {
                    throw new Error(`Could not delete script '${scriptId}': ${err}`);
                }
            });
        }
    }

    async createScript(script: Script): Promise<void> {
        if (this.client && this.isConnected) {
            this.client.emit("setObject", script._id, script, (err: any) => {
                if (err) {
                    throw new Error(`Could not create script '${script._id}': ${err}`);
                }
            });
        }
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
        const script: Script = {
            _id: scriptId,
            common: {
                enabled: isEnabled
            }
        };

        this.updateScript(scriptId, script);
    }
    
    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
