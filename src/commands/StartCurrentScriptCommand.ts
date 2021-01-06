import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptId } from "../models/ScriptId";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";

@injectable()
export class StartCurrentScriptCommand implements ICommand {
    id: string = "iobroker-javascript.startScript";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}
    
    async execute(...args: any[]) {
        const scriptId = await this.tryGetScriptId(args);

        if (scriptId && scriptId.length > 0) {
            try {
                await this.connectionService.startScript(scriptId);
                window.setStatusBarMessage(`ioBroker: Started script '${scriptId}' sucessfully`, CONSTANTS.StatusBarMessageTime);
            } catch (error) {
                window.showErrorMessage((<Error>error).message);
            }
        } else {
            window.showWarningMessage("ioBroker: Cannot start current script.");
        }
    }

    private async tryGetScriptId(...args: any[]): Promise<ScriptId | null> {
        if (args && args[0] && args[0].length > 0) {
            return (<ScriptItem>args[0][0]).script._id;
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return await this.scriptService.getIoBrokerId(activeDocument.uri);
        }

        return null;
    }
}
