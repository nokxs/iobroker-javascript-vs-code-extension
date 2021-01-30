
import { inject, injectable } from "inversify";
import { Uri, WorkspaceFolder } from "vscode";
import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "./IScriptService";
import { EngineType } from "../../models/EngineType";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { ScriptName } from "../../models/ScriptName";
import { ScriptId } from "../../models/ScriptId";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {}
    
    getRelativeFilePathFromScript(script: Script): string {
        if (!script.common?.name) {
            throw new Error(`Name is not set on script with id '${script._id}'`);
        }

        const engineType = <EngineType>script.common.engineType ?? EngineType.unkown;
        return this.getRelativeFilePath(script._id, script.common.name, engineType);
    }

    getRelativeFilePath(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): string {
        let path = scriptId.replace("script.js.", "");
        path = this.replaceAll(path, ".", "/");
        path = this.replaceAll(path, "_", " ");

        let scriptRoot = this.configRepositoryService.config.scriptRoot;
        scriptRoot = scriptRoot.endsWith("/") ? scriptRoot : `${scriptRoot}/`;

        const extension = this.getFileExtension(engineType);
        return `${scriptRoot}${scriptName}.${extension}`;
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

    getEngineType(uri: Uri): EngineType {
        if (uri.path.endsWith(".js")) {
            return EngineType.javascript;
        } else 
        if (uri.path.endsWith(".ts")) {
            return EngineType.typescript;
        } else 
        if (uri.path.endsWith(".block")) {
            return EngineType.blockly;
        } 

        return EngineType.unkown;
    }

    async getFileUri(script: Script): Promise<Uri> {
        const relativeScriptPath = this.getRelativeFilePathFromScript(script);
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        return Uri.joinPath(workspaceFolder.uri, relativeScriptPath);
    }
    
    async getFileContentOnDisk(scriptId: ScriptId, scriptName: ScriptName, engineType: EngineType): Promise<string | null> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        const relativeFilePath = this.getRelativeFilePath(scriptId, scriptName, engineType);
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
    
    async saveAllToFile(scripts: Script[]): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script);
        }
    }

    private getScriptUri(workspaceFolder: WorkspaceFolder, relativeFilePath: string): Uri {
        return Uri.joinPath(workspaceFolder.uri, relativeFilePath);
    }    
    
    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
