import { EngineType } from "../../models/EngineType";
import { ScriptDirectory } from "../../views/scriptExplorer/ScriptDirectory";

export interface IScriptCreationService {
    createFile(scriptDirectory: ScriptDirectory, fileExtension: string, engineType: EngineType): void
}