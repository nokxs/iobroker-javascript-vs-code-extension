import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IScript } from "../../models/IScript";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptRepositoryService {
    init(): Promise<void>
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    updateFromServer(): Promise<void>

    evaluateDirtyStateForAllScripts(): Promise<void>
    evaluateDirtyState(script: ILocalScript): Promise<void>
    evaluateScriptOnRemoteForAllScripts(): Promise<void>
    evaluateScriptOnRemote(script: ILocalScript): Promise<void>

    getAllChangedScripts(): ILocalScript[]
    getAllScripts(): ILocalScript[]
    getAllDirectories(): IDirectory[]

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined
    getScriptFromId(id: ScriptId): ILocalScript | undefined
    getScriptWithLocalContent(localScript: ILocalScript): Promise<IScript | null>

    getRootLevelScript(): ILocalScript[]
    getRootLevelDirectories(): IDirectory[]
    getRootDirectory(): IDirectory

    getScriptsIn(directory: IDirectory): ILocalScript[]
    getDirectoriesIn(directory: IDirectory): IDirectory[]
}
