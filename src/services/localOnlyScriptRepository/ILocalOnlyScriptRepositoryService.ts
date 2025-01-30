import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScript } from "../../models/ILocalOnlyScript";
import { Uri } from "vscode";

export interface ILocalOnlyScriptRepositoryService {
    getLocalOnlyDirectoriesIn(directory: IDirectory) : Promise<ILocalOnlyScript[]>
    getOnlyLocalScriptsIn(directory: IDirectory): Promise<ILocalOnlyScript[]>

    getSupportedLocalDirectories(directoryUri: Uri): Promise<ILocalOnlyScript[]>
    getSupportedLocalOnlyFiles(directoryUri: Uri): Promise<ILocalOnlyScript[]>
}
