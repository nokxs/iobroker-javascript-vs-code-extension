import { EngineType } from "../../models/EngineType";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";
import { Uri } from "vscode";

export interface IScriptService {
    getRelativeFilePathFromScript(script: Script): string
    getRelativeFilePath(scriptId: ScriptId, engineType: EngineType): string
    getFileUri(script: Script): Promise<Uri>
    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType

    getFileContentOnDisk(scriptId: ScriptId, engineType: EngineType): Promise<string | null>
    
    saveToFile(script: Script): Promise<void>
    saveAllToFile(scripts: ScriptObject[]): Promise<void>
}
