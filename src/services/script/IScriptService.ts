import { Uri, WorkspaceFolder } from "vscode";

import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<ScriptId>;
    getRelativeFilePath(script: Script): string;
    
    saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void>
    saveAllToFile(scripts: ScriptObject[], workspaceFolder: WorkspaceFolder): Promise<void>
}
