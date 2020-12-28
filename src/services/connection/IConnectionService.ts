import { Script } from "../../models/script";
import { Uri } from "vscode";

export interface IConnectionEventListener {
    onConnected(): void;
    onDisconnected(): void;
}

export interface IConnectionService {
    isConnected: Boolean;
    
    connect(uri: Uri): Promise<void>;
    disconnect(): Promise<void>;
    
    registerEventListener(listener: IConnectionEventListener): void;

    downloadAllScripts(): Promise<Script[]>;
    downloadScript(scriptPath: String): Promise<Script>;
    uploadScript(script: Script): Promise<void>;
    
    startScript(script: Script): Promise<void>;
    stopScript(script: Script): Promise<void>;

    registerForLogs(script: Script, logAction: () => {}): Promise<void>;
    unregisterForLogs(script: Script): Promise<void>;
}