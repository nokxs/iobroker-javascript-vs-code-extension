import { IDirectory } from "../../models/IDirectory";

export interface ILocalOnlyScriptRepositoryService {
    getOnlyLocalScriptsInDirectory(directory: IDirectory): Promise<string[]>
}
