import { Script, ScriptId, ScriptObject } from "../../models/Script";
import { Uri, WorkspaceFolder } from "vscode";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<ScriptId>;
    getRelativeFilePath(script: Script): string;
    
    saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void>
    saveAllToFile(scripts: ScriptObject[], workspaceFolder: WorkspaceFolder): Promise<void>
}
