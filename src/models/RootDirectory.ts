import { Uri } from "vscode";
import { IDirectory } from "./IDirectory";
import { IDirectoryCommon } from "./IDirectoryCommon";
import { ScriptId } from "./ScriptId";

export class RootDirectory implements IDirectory {
    common: IDirectoryCommon = {};
    _id: ScriptId = "script.js";
    relativeUri = Uri.parse("./");
}