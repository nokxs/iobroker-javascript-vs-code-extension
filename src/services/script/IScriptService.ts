import { EngineType } from "../../models/EngineType";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptName } from "../../models/ScriptName";
import { Uri } from "vscode";

export interface IScriptService {
    getRelativeFilePathFromScript(script: Script): string
    getRelativeFilePath(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): string;
    getFileUri(script: Script): Promise<Uri>
    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType

    getFileContentOnDisk(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): Promise<string | null>
    
    saveToFile(script: Script): Promise<void>
    saveAllToFile(scripts: Script[]): Promise<void>
}
