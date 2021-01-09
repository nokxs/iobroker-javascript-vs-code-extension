
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
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {}
    
    getRelativeFilePathFromScript(script: Script): string {
        let path = script._id.replace("script.js.", "");
        const engineType = <EngineType>script.common.engineType ?? EngineType.unkown;
        return this.getRelativeFilePath(path, engineType);
    }
    
    getRelativeFilePath(scriptId: ScriptId, engineType: EngineType): string {
        let path = scriptId.replace("script.js.", "");
        path = this.replaceAll(path, ".", "/");
        path = this.replaceAll(path, "_", " ");

        let scriptRoot = this.configRepositoryService.config.scriptRoot;
        scriptRoot = scriptRoot.endsWith("/") ? scriptRoot : `${scriptRoot}/`;

        const extension = this.getFileExtension(engineType);
        return `${scriptRoot}${path}.${extension}`;
    }
    
    getFileExtension(engineType: EngineType): string {
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

    async getFileUri(script: Script): Promise<Uri> {
        const relativeScriptPath = this.getRelativeFilePathFromScript(script);
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        return Uri.joinPath(workspaceFolder.uri, relativeScriptPath);
    }
    
    async getFileContentOnDisk(scriptId: ScriptId, engineType: EngineType): Promise<string | null> {
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

    private getScriptUri(workspaceFolder: WorkspaceFolder, relativeFilePath: string): Uri {
        return Uri.joinPath(workspaceFolder.uri, relativeFilePath);
    }    
    
    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
