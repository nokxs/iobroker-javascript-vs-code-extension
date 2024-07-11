import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { IScriptCreationService } from "../services/scriptCreation/IScriptCreationService";
import { EngineType } from "../models/EngineType";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { window } from "vscode";

@injectable()
export class CreateScriptFileCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createScriptFile";

    constructor(        
        @inject(TYPES.services.scriptCreationService) private scriptCreationService: IScriptCreationService,
        @inject(TYPES.services.scriptRepository) private scriptRepository: IScriptRepositoryService
    ) {}
    
    async execute() {
        const typeScript = "TypeScript";
        const javaScript = "JavaScript";

        const selectedScriptType = await window.showQuickPick([typeScript, javaScript], {placeHolder: "Create scriopt with type..."});

        if (selectedScriptType === typeScript) {
            await this.scriptCreationService.createFileIDirectory(this.scriptRepository.getRootDirectory(), ".ts", EngineType.typescript);
        }
        else if (selectedScriptType === javaScript) {
            await this.scriptCreationService.createFileIDirectory(this.scriptRepository.getRootDirectory(), ".js", EngineType.javascript);
        }
    }
}
