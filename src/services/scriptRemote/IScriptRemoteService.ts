import { IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";
import { IScriptChangedEventListener } from "./IScriptChangedListener";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptRemoteService {        
    init(): void
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
