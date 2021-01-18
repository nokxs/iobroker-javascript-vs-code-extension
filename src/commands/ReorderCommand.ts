import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { Script } from "../models/Script";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";

@injectable()
export class ReorderCommand implements ICommand {
    id: string = "iobroker-javascript.download";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}
    
    async execute(...args: any[]) {
        
    }
}
