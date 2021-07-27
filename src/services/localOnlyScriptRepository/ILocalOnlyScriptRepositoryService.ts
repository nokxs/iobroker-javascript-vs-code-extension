import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScript } from "../../models/ILocalOnlyScript";

export interface ILocalOnlyScriptRepositoryService {
    getLocalOnlyDirectoriesIn(directory: IDirectory) : Promise<ILocalOnlyScript[]>
    getOnlyLocalScriptsIn(directory: IDirectory): Promise<ILocalOnlyScript[]>
}
