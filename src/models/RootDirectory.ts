import { inject } from "inversify";
import { Uri } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import TYPES from "../Types";
import { IDirectory } from "./IDirectory";
import { IDirectoryCommon } from "./IDirectoryCommon";
import { ScriptId } from "./ScriptId";

export class RootDirectory implements IDirectory {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ){}
    
    common: IDirectoryCommon = {};
    _id: ScriptId = "script.js";
    relativeUri = Uri.parse("./");
    absoluteUri = this.workspaceService.workspaceToUse.uri;
}