import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { ScriptId } from "../models/ScriptId";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";

@injectable()
export class StopCurrentScriptCommand implements ICommand {
    id: string = "iobroker-javascript.stopScript";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
    ) {}
    
    async execute(...args: any[]) {
        const scriptId = await this.tryGetScriptId(args);

        if (scriptId && scriptId.length > 0) {
            try {
                await this.connectionService.stopScript(scriptId);
                window.setStatusBarMessage(`ioBroker: Stoped script '${scriptId}' sucessfully`, CONSTANTS.StatusBarMessageTime);
            } catch (error) {
                window.showErrorMessage((<Error>error).message);
            }
        } else {
            window.showWarningMessage("ioBroker: Cannot stop current script.");
        }
    }

    private async tryGetScriptId(...args: any[]): Promise<ScriptId | null> {
        if (args && args[0] && args[0].length > 0) {
            return (<ScriptItem>args[0][0]).script._id;
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return await this.scriptIdService.getIoBrokerId(activeDocument.uri);
        }

        return null;
    } 
}
