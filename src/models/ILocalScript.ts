import { IScript } from "./IScript";
import { ScriptId } from "./ScriptId";
import { Uri } from "vscode";

export interface ILocalScript {
    _id: ScriptId
    ioBrokerScript: IScript
    absoluteUri: Uri
    relativeUri: Uri
    isDirty: boolean
}
