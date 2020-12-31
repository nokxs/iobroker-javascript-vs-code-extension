import * as socketio from 'socket.io-client';

import { IConnectionEventListener, IConnectionService } from "./IConnectionService";

import { Script, ScriptObject } from "../../models/Script";
import { Uri } from "vscode";
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
            }
        });
    }

    downloadScript(scriptUri: Uri): Promise<Script> {
        return new Promise<Script>(async (resolve) => {
            if (this.client && this.isConnected) {
                const ioBrokerId = await this.scriptService.getIoBrokerId(scriptUri);

                this.client.emit("getObject", ioBrokerId, (err: any, script: Script) => {
                    resolve(script);
                });
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

    startScript(script: ScriptObject): Promise<void> {
        throw new Error("Method not implemented.");
    }

    stopScript(script: ScriptObject): Promise<void> {
        throw new Error("Method not implemented.");
    }

    registerForLogs(script: Script, logAction: () => void): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.client && this.isConnected) {

                this.client.on("log", (message: LogMessage) => {
                    console.log(message);
                });
    
                this.client.emit("requireLog", true, (err: any) => {
                    console.log(err);
                    resolve();
                });
            }
        });

        // socketio.on("objectChange", (id: string, value: any) => {
        // 	console.log(`Object: ${id}: ${JSON.stringify(value)}`);
        // });
    }

    unregisterForLogs(script: ScriptObject): Promise<void> {
        throw new Error("Method not implemented.");
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
}