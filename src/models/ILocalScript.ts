import { Uri } from "vscode";
import { IScript } from "./IScript";
import { ScriptId } from "./ScriptId";

export interface ILocalScript {
    _id: ScriptId
    ioBrokerScript: IScript
    absoluteUri: Uri
    relativeUri: Uri
}
