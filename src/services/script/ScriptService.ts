
import { inject, injectable } from "inversify";
import { Uri, WorkspaceFolder } from "vscode";
import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "./IScriptService";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.file) private fileService: IFileService,
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
    
    getRelativeFilePathFromScript(script: Script): string {
        var path = script._id.replace("script.js.", "");
        const engineType = script.common.engineType ?? "";
        return this.getRelativeFilePath(path, engineType);
    }
    
    getRelativeFilePath(scriptId: ScriptId, engineType: string): string {
        var path = scriptId.replace("script.js.", "");
        path = this.replaceAll(path, ".", "/");
        path = this.replaceAll(path, "_", " ");
        const extension = this.getFileExtension(engineType);
        return `${path}.${extension}`;
    }

    async getFileContentOnDisk(scriptId: ScriptId, engineType: string): Promise<string | null> {
        const workspace = await this.workspaceService.getWorkspaceToUse();
        const relativeFilePath = this.getRelativeFilePath(scriptId, engineType);
        const scriptUri = Uri.joinPath(workspace.uri, relativeFilePath);

        if (this.fileService.fileExists(scriptUri)) {
            return this.fileService.readFromFile(scriptUri);
        }

        return null;
    }

    async saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void> {
        const relativeFilePath = this.getRelativeFilePathFromScript(script);
        const uri = Uri.joinPath(workspaceFolder.uri, relativeFilePath);

        await this.fileService.saveToFile(uri, script.common.source ?? "");
    }
    
    async saveAllToFile(scripts: ScriptObject[], workspaceFolder: WorkspaceFolder): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script.value, workspaceFolder);
        }
    }

    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }

    private getFileExtension(engineType: string): string {
        switch (engineType) {
            case "Javascript/js":
                return "js";
            case "TypeScript/ts":
                return "ts";
            case "Blockly":
                return "block";
        
            default:
                return "";
        }
    }
}