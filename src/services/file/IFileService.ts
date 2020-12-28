import { Script } from "../../models/script";
import { WorkspaceFolder } from "vscode";

export interface IFileService {
    saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void>;
    saveAllToFile(scripts: Script[], workspaceFolder: WorkspaceFolder): Promise<void>;
}