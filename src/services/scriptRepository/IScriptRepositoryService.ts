import { IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";

export interface IScriptRepositoryService {
    updateFromServer(): Promise<void>
    getScriptsIn(directory: IDirectory): IScript[]
    getDirectories(directory: IDirectory): IDirectory[]
}
