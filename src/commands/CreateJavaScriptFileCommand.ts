import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { IScriptCreationService } from "../services/scriptCreation/IScriptCreationService";
import { EngineType } from "../models/EngineType";

@injectable()
export class CreateJavaScriptFileCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createJavaScriptFile";

    constructor(        
        @inject(TYPES.services.scriptCreationService) private scriptCreationService: IScriptCreationService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];
            this.scriptCreationService.createFile(scriptDirectory, ".js", EngineType.javascript);
        }
    }
}
