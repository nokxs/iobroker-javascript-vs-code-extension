import { LogMessage } from "../../models/LogMessage";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";
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
    downloadScriptWithUri(scriptPath: Uri): Promise<Script>;
    uploadScript(script: Script): Promise<void>;
    
    startScript(script: ScriptId): Promise<void>;
    stopScript(scriptId: ScriptId): Promise<void>;

    registerForLogs(logAction: (logMessage: LogMessage) => void): Promise<void>;
    unregisterForLogs(): Promise<void>;
}