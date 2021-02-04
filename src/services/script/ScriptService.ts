import { inject, injectable } from "inversify";
import { Uri, WorkspaceFolder } from "vscode";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "./IScriptService";
import { EngineType } from "../../models/EngineType";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { ILocalScript } from "../../models/ILocalScript";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {}
        
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
    
    async getFileContentOnDisk(script: ILocalScript): Promise<string | null> {
        
        if (this.fileService.fileExists(script.absoluteUri)) {
            return this.fileService.readFromFile(script.absoluteUri);
        }

        return null;
    }

    async saveToFile(script: ILocalScript): Promise<void> {
        await this.fileService.saveToFile(script.absoluteUri, script.ioBrokerScript.common.source ?? "");
    }
    
    async saveAllToFile(scripts: ILocalScript[]): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script);
        }
    }
}
