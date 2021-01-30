import { EngineType } from "../../models/EngineType";
import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { Uri } from "vscode";
import { ScriptName } from "../../models/ScriptName";

export interface IScriptService {
    getRelativeFilePathFromScript(script: Script): string
    getRelativeFilePath(scriptName: ScriptName, engineType: EngineType): string;
    getFileUri(script: Script): Promise<Uri>
    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType

    getFileContentOnDisk(scriptName: ScriptName, engineType: EngineType): Promise<string | null>
    
    saveToFile(script: Script): Promise<void>
    saveAllToFile(scripts: ScriptObject[]): Promise<void>
}
