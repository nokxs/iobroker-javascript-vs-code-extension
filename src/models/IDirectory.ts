import { Uri } from "vscode";
import { IDirectoryCommon } from "./IDirectoryCommon";
import { ScriptId } from "./ScriptId";

export interface IDirectory {
    common: IDirectoryCommon
    _id: ScriptId
    relativeUri: Uri
}