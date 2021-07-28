import { inject } from "inversify";
import { Uri } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { IConfigRepositoryService } from "../services/configRepository/IConfigRepositoryService";
import TYPES from "../Types";
import { IDirectory } from "./IDirectory";
import { IDirectoryCommon } from "./IDirectoryCommon";
import { ScriptId } from "./ScriptId";

export class RootDirectory implements IDirectory {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ){}
    
    common: IDirectoryCommon = {};
    _id: ScriptId = "script.js";
    relativeUri = Uri.parse("./");
    absoluteUri = Uri.joinPath(this.workspaceService.workspaceToUse.uri, this.configRepositoryService.config.scriptRoot);
}