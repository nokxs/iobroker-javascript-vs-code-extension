import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IScriptService } from "./IScriptService";
import { EngineType, getEngineTypeFromFileExtension, getEngineTypeInfo } from "../../models/EngineType";
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
        
    getFileExtension(engineType: string | undefined): string {
        return getEngineTypeInfo(engineType)?.fileExtension ?? "txt";
    }

    getEngineType(uri: Uri): EngineType {
        const lastDot = uri.path.lastIndexOf(".");
        if (lastDot < 0) {
            return EngineType.unkown;
        }

        return getEngineTypeFromFileExtension(uri.path.substring(lastDot + 1));
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
