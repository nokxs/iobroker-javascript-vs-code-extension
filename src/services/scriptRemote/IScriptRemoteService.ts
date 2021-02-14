import { IScriptChangedEventListener } from "./IScriptChangedListener";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { IDirectory } from "../../models/IDirectory";

export interface IScriptRemoteService {        
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    downloadAllScripts(): Promise<IScript[]>
    downloadScriptWithUri(scriptPath: Uri): Promise<IScript>
    downloadScriptWithId(scriptId: ScriptId): Promise<IScript>
    uploadScript(script: IScript): Promise<void>

    startScript(script: ScriptId): Promise<void>
    stopScript(scriptId: ScriptId): Promise<void>

    update(scriptId: ScriptId, script: IScript): Promise<void>    
    rename(scriptId: ScriptId, name: string): Promise<void>
    move(scriptId: ScriptId, targetDirectory: IDirectory): Promise<void>
    delete(scriptId: ScriptId): Promise<void>
}
