import { Script, ScriptObject } from "../../models/Script";

import { WorkspaceFolder } from "vscode";

export interface IFileService {
    saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void>;
    saveAllToFile(scripts: ScriptObject[], workspaceFolder: WorkspaceFolder): Promise<void>;
}