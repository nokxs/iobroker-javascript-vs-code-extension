
import { inject, injectable } from "inversify";
import { Uri, WorkspaceFolder } from "vscode";
import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "./IScriptService";
import { EngineType } from "../../models/EngineType";

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
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        const relativeFilePath = this.getRelativeFilePath(scriptId, engineType);
        const scriptUri = this.getScriptUri(workspaceFolder, relativeFilePath);

        if (this.fileService.fileExists(scriptUri)) {
            return this.fileService.readFromFile(scriptUri);
        }

        return null;
    }

    async saveToFile(script: Script): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        const relativeFilePath = this.getRelativeFilePathFromScript(script);
        const scriptUri = this.getScriptUri(workspaceFolder, relativeFilePath);

        await this.fileService.saveToFile(scriptUri, script.common.source ?? "");
    }
    
    async saveAllToFile(scripts: ScriptObject[]): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script.value);
        }
    }

    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }

    private getFileExtension(engineType: string): string {
        switch (engineType?.toLowerCase()) {
            case EngineType.javascript:
                return "js";
            case EngineType.typescript:
                return "ts";
            case EngineType.blockly:
                return "block";
        
            default:
                return "";
        }
    }

    private getScriptUri(workspaceFolder: WorkspaceFolder, relativeFilePath: string): Uri {
        const workspaceSubPath = this.iobrokerConnectionService.config.workspaceSubPath;
        return Uri.joinPath(workspaceFolder.uri, workspaceSubPath, relativeFilePath);
    }
}
