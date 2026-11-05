import { EngineType } from "../../models/EngineType";
import { IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";
import { ScriptDirectory } from "../../views/scriptExplorer/ScriptDirectory";

export interface IScriptCreationService {
    createFileScriptDirectory(scriptDirectory: ScriptDirectory, fileExtension: string, engineType: EngineType): Promise<void>
    
    createFileIDirectory(scriptDirectory: IDirectory, fileExtension: string, engineType: EngineType): Promise<void>

    /**
     * Creates a script on the ioBroker server and the matching local file without asking the user
     * for anything. Throws if the script or the file does already exist, unless `overwrite` is set.
     */
    createFileWithName(scriptDirectory: IDirectory, fileName: string, fileExtension: string, engineType: EngineType, source?: string, overwrite?: boolean): Promise<IScript>
}