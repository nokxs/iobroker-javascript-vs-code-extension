
import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptIdService } from "./IScriptIdService";

@injectable()
export class ScriptIdService implements IScriptIdService {

    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}

    async getIoBrokerId(fileUri: Uri): Promise<ScriptId> {
        if (fileUri.scheme !== "file") {
            return "";
        }
        
        const workspace = await this.workspaceService.getWorkspaceToUse();
        const idSuffixPath = fileUri.path.substr(workspace.uri.path.length);
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
