import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptRepositoryService {
    init(): Promise<void>
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    updateFromServer(): Promise<void>
    evaluateDirtyState(): Promise<void>

    getAllScripts(): ILocalScript[]
    getAllDirectories(): IDirectory[]

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined
    getScriptFromId(id: ScriptId): ILocalScript | undefined

    getRootLevelScript(): ILocalScript[]
    getRootLevelDirectories(): IDirectory[]

    getScriptsIn(directory: IDirectory): ILocalScript[]
    getDirectoriesIn(directory: IDirectory): IDirectory[]
}
