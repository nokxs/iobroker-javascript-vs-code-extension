import { IConnectionEventListener } from "./IConnectionEventListener";
import { IScriptChangedEventListener } from "./IScriptChangedListener";
import { LogMessage } from "../../models/LogMessage";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";
import { Uri } from "vscode";

export interface IConnectionService {
    isConnected: Boolean;
    
    connect(uri: Uri): Promise<void>
    disconnect(): Promise<void>
    
    registerConnectionEventListener(listener: IConnectionEventListener): void
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    downloadAllScripts(): Promise<ScriptObject[]>
    downloadScriptWithUri(scriptPath: Uri): Promise<Script>
    downloadScriptWithId(scriptId: ScriptId): Promise<Script>
    uploadScript(script: Script): Promise<void>
    
    startScript(script: ScriptId): Promise<void>
    stopScript(scriptId: ScriptId): Promise<void>

    registerForLogs(logAction: (logMessage: LogMessage) => void): Promise<void>
    unregisterForLogs(): Promise<void>

    updateScript(scriptId: ScriptId, script: Script): Promise<void>    
    rename(scriptId: ScriptId, name: string): Promise<void>
}
