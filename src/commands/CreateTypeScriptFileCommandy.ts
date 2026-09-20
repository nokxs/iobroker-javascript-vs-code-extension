import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { EngineType } from "../models/EngineType";
import { IScriptCreationService } from "../services/scriptCreation/IScriptCreationService";

@injectable()
export class CreateTypeScriptFileCommandy implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createTypeScriptFile";

    constructor(        
        @inject(TYPES.services.scriptCreationService) private scriptCreationService: IScriptCreationService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];
            this.scriptCreationService.createFileScriptDirectory(scriptDirectory, ".ts", EngineType.typescript);
        }
    }
}
