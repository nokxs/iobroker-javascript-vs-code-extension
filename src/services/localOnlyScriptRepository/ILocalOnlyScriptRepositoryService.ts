import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScript } from "../../models/ILocalOnlyScript";

export interface ILocalOnlyScriptRepositoryService {
    getOnlyLocalScriptsInDirectory(directory: IDirectory): Promise<ILocalOnlyScript[]>
}
