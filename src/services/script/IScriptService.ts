import { EngineType } from "../../models/EngineType";
import { Uri } from "vscode";
import { ILocalScript } from "../../models/ILocalScript";

export interface IScriptService {

    getFileExtension(engineType: EngineType): string
    getEngineType(uri: Uri): EngineType

    getFileContentOnDisk(script: ILocalScript): Promise<string | null>
    
    saveToFile(script: ILocalScript): Promise<void>
    saveAllToFile(scripts: ILocalScript[]): Promise<void>
}
