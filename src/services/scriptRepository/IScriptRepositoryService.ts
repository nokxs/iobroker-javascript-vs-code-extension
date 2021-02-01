import { IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";

export interface IScriptRepositoryService {
    init(): Promise<void>
    
    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void

    updateFromServer(): Promise<void>
    getScriptsIn(directory: IDirectory): IScript[]
    getDirectoriesIn(directory: IDirectory): IDirectory[]

}
