
import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptIdService } from "./IScriptIdService";

@injectable()
export class ScriptIdService implements IScriptIdService {

    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {}

    getIoBrokerId(fileUri: Uri): ScriptId {
        if (fileUri.scheme !== "file") {
            return "";
        }
        
        const workspace = this.workspaceService.workspaceToUse;
        if (!workspace) {
            return "";
        }
        const scriptRoot = this.configRepositoryService.config.scriptRoot;
        const idSuffixPath = fileUri.path.substr(Uri.joinPath(workspace.uri, scriptRoot).path.length);
        const suffixLength = idSuffixPath.lastIndexOf(".");

        let path = idSuffixPath.substring(0, suffixLength);
        path = this.replaceAll(path, "/", ".");
        path = this.replaceAll(path, " ", "_");

        return new ScriptId(`script.js${path}`);
    }

    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
