
import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { ScriptId, ScriptObject } from "../../models/Script";
import TYPES from "../../Types";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "./IScriptService";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) {}

    async getIoBrokerId(fileUri: Uri): Promise<ScriptId> {
        if (fileUri.scheme !== "file") {
            return "";
        }
        
        const workspace = await this.workspaceService.getWorkspaceToUse();
        const idSuffixPath = fileUri.path.substr(workspace.uri.path.length);
        const suffixLength = idSuffixPath.lastIndexOf(".");

        var path = idSuffixPath.substring(0, suffixLength);
        path = this.replaceAll(path, "/", ".");
        path = this.replaceAll(path, " ", "_");

        return new ScriptId(`script.js${path}`);
    }
    
    getRelativeFilePath(script: ScriptObject): string {
        var path = script.id.replace("script.js.", "");
        path = this.replaceAll(path, ".", "/");
        path = this.replaceAll(path, "_", " ");
        const extension = script.value.common.engineType === "Javascript/js" ? "js" : ""; // TODO support for different file formats
        return `${path}.${extension}`;
    }

    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}