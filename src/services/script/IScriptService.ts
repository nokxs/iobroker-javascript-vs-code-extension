import { EngineType } from "../../models/EngineType";
import { ILocalScript } from "../../models/ILocalScript";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptService {

    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType
    getDefaultScript(id: ScriptId, engineType: EngineType): IScript

    getFileContentOnDisk(script: ILocalScript): Promise<string | null>
    
    saveToFile(script: ILocalScript): Promise<void>
    saveAllToFile(scripts: ILocalScript[]): Promise<void>
}
