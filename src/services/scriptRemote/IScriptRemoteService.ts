import { IScriptChangedEventListener } from "./IScriptChangedListener";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptRemoteService {        
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    downloadAllScripts(): Promise<Script[]>
    downloadScriptWithUri(scriptPath: Uri): Promise<Script>
    downloadScriptWithId(scriptId: ScriptId): Promise<Script>
    uploadScript(script: Script): Promise<void>

    startScript(script: ScriptId): Promise<void>
    stopScript(scriptId: ScriptId): Promise<void>

    updateScript(scriptId: ScriptId, script: Script): Promise<void>    
    rename(scriptId: ScriptId, name: string): Promise<void>
}
