import { Script, ScriptId } from "../../models/Script";

import { Uri } from "vscode";

export interface IScriptService {
    getIoBrokerId(fileUri: Uri): Promise<ScriptId>;
    getRelativeFilePath(script: Script): string;
}
