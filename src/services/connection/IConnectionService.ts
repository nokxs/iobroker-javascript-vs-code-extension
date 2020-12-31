import { Script, ScriptObject } from "../../models/Script";

import { LogMessage } from "../../models/LogMessage";
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

    downloadAllScripts(): Promise<ScriptObject[]>;
    downloadScript(scriptPath: Uri): Promise<Script>;
    uploadScript(script: Script): Promise<void>;
    
    startScript(script: Script): Promise<void>;
    stopScript(script: ScriptObject): Promise<void>;

    registerForLogs(logAction: (logMessage: LogMessage) => void): Promise<void>;
    unregisterForLogs(): Promise<void>;
}