import { EngineType } from "../../models/EngineType";
import { IDirectory } from "../../models/IDirectory";
import { ScriptDirectory } from "../../views/scriptExplorer/ScriptDirectory";

export interface IScriptCreationService {
    createFileScriptDirectory(scriptDirectory: ScriptDirectory, fileExtension: string, engineType: EngineType): Promise<void>
    
    createFileIDirectory(scriptDirectory: IDirectory, fileExtension: string, engineType: EngineType): Promise<void>
}