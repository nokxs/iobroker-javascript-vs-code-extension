import { ScriptObject } from "../../models/Script";
import { Uri } from "vscode";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<string>;
    getRelativeFilePath(script: ScriptObject): string;
}
