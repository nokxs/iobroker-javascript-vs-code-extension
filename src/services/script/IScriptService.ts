import { ScriptId, ScriptObject } from "../../models/Script";

import { Uri } from "vscode";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<ScriptId>;
    getRelativeFilePath(script: ScriptObject): string;
}
