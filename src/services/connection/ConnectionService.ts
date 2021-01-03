import * as socketio from 'socket.io-client';

import { IConnectionEventListener, IConnectionService } from "./IConnectionService";

import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import { Uri, window } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IScriptService } from '../script/IScriptService';
import { LogMessage } from '../../models/LogMessage';

@injectable()
export class ConnectionService implements IConnectionService {
    public isConnected: Boolean = false;

    private eventListeners: IConnectionEventListener[] = new Array();
    private client: SocketIOClient.Socket | undefined = undefined;
    
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}

    registerEventListener(listener: IConnectionEventListener): void {
        this.eventListeners.push(listener);
    }
    
    async connect(uri: Uri): Promise<void> {
        this.client = await new Promise<SocketIOClient.Socket>((resolve) => {
            const localClient = socketio(uri.toString());

            localClient.on("connect", () => {
                this.isConnected = true;
                resolve(localClient);
            });
        });

        this.registerSocketEvents();
    }

    async disconnect(): Promise<void> {
        await new Promise<void>((resolve) => {
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
        return new Promise<Script>(async (resolve) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObject", scriptId, (err: any, script: Script) => {
                    resolve(script);
                });
            } else {
                resolve({_id: "INVALID", common: {}}); // TODO: Add Type "InvalidScript"
            }
        });
    }

    uploadScript(script: Script): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.client && this.isConnected) {
                this.client.emit("setObject", script._id, script, (err: any) => {
                    resolve();
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
        return new Promise<void>(async (resolve) => {
            if (this.client && this.isConnected) {

                this.client.on("log", (message: LogMessage) => {
                    logAction(message);
                });
    
                this.client.emit("requireLog", true, (err: any) => {
                    if (err) {
                        throw new Error(`Could not register for logs: ${err}`);
                    } 
                    
                    resolve();
                });
            }
        });
    }

    unregisterForLogs(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.client && this.isConnected) {

                this.client.off("log");    
                this.client.emit("requireLog", false, (err: any) => {
                    if (err) {
                        throw new Error(`Could not unregister for logs: ${err}`);
                    } 
                    
                    resolve();
                });
            }
        });
    }

    private registerSocketEvents(): void {
        if (this.client) {
            this.client.on("connect", () => {
                this.isConnected = true;
                this.eventListeners.forEach(listener => listener.onConnected());
            });
            
            this.client.on("disconnect", () => {
                this.isConnected = false;
                this.eventListeners.forEach(listener => listener.onDisconnected());
            });
        }
    }

    private setScriptState(scriptId: ScriptId, isEnabled: boolean): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
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
                        
                        resolve();
                    });
                } else {
                    reject(new Error(`Could set script state for '${scriptId}' to '${isEnabled}', because it is not known to ioBroker`));
                    // throw new Error(`Could set script state for '${scriptId}' to '${isEnabled}', because it is not known to ioBroker`);
                }
            }
        });
    }
}