import { Directory } from "../../models/Directory";
import { Script } from "../../models/Script";

export interface IScriptRepositoryService {
    updateFromServer(): Promise<void>;
    getScriptsIn(scriptDirectory: Directory): Promise<Script[]>;
    getDirectories(scriptDirectory: Directory): Promise<Directory[]>;
    getAllDirectoriesFlatPath(): Promise<string[]>;
}
