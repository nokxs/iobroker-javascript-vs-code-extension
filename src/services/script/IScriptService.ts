import { EngineType } from "../../models/EngineType";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { ScriptName } from "../../models/ScriptName";
import { Uri } from "vscode";

export interface IScriptService {
    getRelativeFilePathFromScript(script: IScript): string
    getRelativeFilePath(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): string
    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType

    getFileContentOnDisk(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): Promise<string | null>
    
    saveToFile(script: IScript): Promise<void>
    saveAllToFile(scripts: IScript[]): Promise<void>
}
