import { Uri } from "vscode";
import { IDirectoryCommon } from "./IDirectoryCommon";
import { ScriptId } from "./ScriptId";

export interface IDirectory {
    common: IDirectoryCommon
    _id: ScriptId
    relativeUri: Uri,
    absoluteUri: Uri
}

/** The part of a directory that only describes the ioBroker object, without a local folder. */
export type DirectoryReference = Pick<IDirectory, "_id" | "common">;