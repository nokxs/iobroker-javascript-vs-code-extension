import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";

export interface IScriptRepositoryService {
    init(): Promise<void>
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    updateFromServer(): Promise<void>

    getRootLevelScript(): ILocalScript[]
    getRootLevelDirectories(): IDirectory[]

    getScriptsIn(directory: IDirectory): ILocalScript[]
    getDirectoriesIn(directory: IDirectory): IDirectory[]

}
