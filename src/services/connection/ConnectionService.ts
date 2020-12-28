import * as socketio from 'socket.io-client';

import { IConnectionEventListener, IConnectionService } from "./IConnectionService";

import { Script } from "../../models/script";
import { Uri } from "vscode";
import { injectable } from "inversify";

@injectable()
export class ConnectionService implements IConnectionService {
    public isConnected: Boolean = false;

    private eventListeners: IConnectionEventListener[] = new Array();
    private client: SocketIOClient.Socket | undefined = undefined;

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

    downloadAllScripts(): Promise<Script[]> {
        return new Promise<Script[]>((resolve) => {
            if (this.client && this.isConnected) {
                this.client.emit("getObjectView", "system","script",{"startkey":"script.js.","endkey":"script.js.\u9999"}, (err: any, doc: { rows: Script[]}) => {
                    resolve(doc.rows);
                });
            }
        });
    }

    downloadScript(scriptPath: String): Promise<Script> {
        throw new Error("Method not implemented.");
    }

    uploadScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    startScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    stopScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    registerForLogs(script: Script, logAction: () => {}): Promise<void> {
        throw new Error("Method not implemented.");
    }

    unregisterForLogs(script: Script): Promise<void> {
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