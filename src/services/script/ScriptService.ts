import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IScriptService } from "./IScriptService";
import { EngineType } from "../../models/EngineType";
import { ILocalScript } from "../../models/ILocalScript";
import { ScriptId } from "../../models/ScriptId";
import { IScript } from "../../models/IScript";
import { IScriptIdService } from "../scriptId/IScriptIdService";

@injectable()
export class ScriptService implements IScriptService {
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService   
    ) {}
        
    getFileExtension(engineType: EngineType): string {
        switch (engineType?.toLowerCase()) {
            case EngineType.javascript:
                return "js";
            case EngineType.typescript:
                return "ts";
            case EngineType.blockly:
                return "block";
            case EngineType.rules:
                return "rules";
        
            default:
                return "txt";
        }
    }

    getEngineType(uri: Uri): EngineType {
        if (uri.path.endsWith(".js")) {
            return EngineType.javascript;
        } 
        else if (uri.path.endsWith(".ts")) {
            return EngineType.typescript;
        } 
        else if (uri.path.endsWith(".block")) {
            return EngineType.blockly;
        } 
        else if(uri.path.endsWith(".rules")) {
            return EngineType.rules;
        }

        return EngineType.unkown;
    }

    getDefaultScript(id: ScriptId, engineType: EngineType): IScript {
        const script: IScript = {
            _id: this.scriptIdService.sanatizeId(id),
            common: {
                engine: "system.adapter.javascript.0",
                engineType: engineType,
                name: id.substring(id.lastIndexOf(".") + 1),
                source: "",
                debug: false,
                verbose: false,
                enabled: false,
                expert: true
            },
            type: "script"
        };

        return script;
    }
    
    async getFileContentOnDisk(absoluteFileUri: Uri): Promise<string | null> {
        
        if (this.fileService.fileExists(absoluteFileUri)) {
            return this.fileService.readFromFile(absoluteFileUri);
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
    
    async existsScriptLocally(absoluteUri: Uri): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const scriptExistsLocally = this.fileService.fileExists(absoluteUri);
            resolve(scriptExistsLocally);
        });
    }
}
