import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptId } from "../models/ScriptId";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";

@injectable()
export class StopCurrentScriptCommand implements ICommand {
    id: string = "iobroker-javascript.stopScript";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}
    
    async execute(...args: any[]) {
        const scriptId = this.tryGetScriptId(args);

        if (scriptId instanceof ScriptId && scriptId.length > 0) {
            try {
                await this.connectionService.stopScript(scriptId);
                window.setStatusBarMessage(`ioBroker: Stoped script '${scriptId}' sucessfully`, 10 * 1000);
            } catch (error) {
                window.showErrorMessage((<Error>error).message);
            }
        } else {
            window.showWarningMessage("ioBroker: Cannot start current script.");
        }
    }

    private async tryGetScriptId(...args: any[]): Promise<ScriptId | null> {
        if (args && args[0]) {
            return (<ScriptItem>args[0][0]).script._id;
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return await this.scriptService.getIoBrokerId(activeDocument.uri);
        }

        return null;
    } 
}
