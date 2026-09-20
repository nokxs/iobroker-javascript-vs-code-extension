import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IScriptIdService {
    getIoBrokerId(fileUri: Uri): ScriptId
    sanatizeId(scriptId: ScriptId): ScriptId
}
