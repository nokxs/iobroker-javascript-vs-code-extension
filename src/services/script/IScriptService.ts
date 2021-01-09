import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";
import { Uri } from "vscode";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<ScriptId>;
    getRelativeFilePathFromScript(script: Script): string
    getRelativeFilePath(scriptId: ScriptId, engineType: string): string
    getFileContentOnDisk(scriptId: ScriptId, engineType: string): Promise<string | null>
    
    saveToFile(script: Script): Promise<void>
    saveAllToFile(scripts: ScriptObject[]): Promise<void>
}
