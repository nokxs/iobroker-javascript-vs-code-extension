import { Uri } from "vscode";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { ScriptId } from "../../models/ScriptId";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";

export interface IScriptRepositoryService {
    init(): Promise<void>
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    updateFromServer(): Promise<void>

    getAllScripts(): ILocalScript[]

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined
    getScriptFromId(id: ScriptId): ILocalScript | undefined

    getRootLevelScript(): ILocalScript[]
    getRootLevelDirectories(): IDirectory[]

    getScriptsIn(directory: IDirectory): ILocalScript[]
    getDirectoriesIn(directory: IDirectory): IDirectory[]
}
