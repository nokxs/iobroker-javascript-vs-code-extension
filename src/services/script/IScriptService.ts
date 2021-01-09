import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import { ScriptObject } from "../../models/ScriptObject";

export interface IScriptService {
    getRelativeFilePathFromScript(script: Script): string
    getRelativeFilePath(scriptId: ScriptId, engineType: string): string
    getFileContentOnDisk(scriptId: ScriptId, engineType: string): Promise<string | null>
    
    saveToFile(script: Script): Promise<void>
    saveAllToFile(scripts: ScriptObject[]): Promise<void>
}
