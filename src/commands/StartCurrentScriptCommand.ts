import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { ScriptId } from "../models/ScriptId";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class StartCurrentScriptCommand implements ICommand {
    id: string = "iobroker-javascript.startScript";
    
    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
    ) {}
    
    async execute(...args: any[]) {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }
        
        const scriptId = this.tryGetScriptId(args);

        if (scriptId && scriptId.length > 0) {
            try {
                await this.scriptRemoteService.startScript(scriptId);
                window.setStatusBarMessage(`ioBroker: Started script '${scriptId}' sucessfully`, CONSTANTS.StatusBarMessageTime);
            } catch (error) {
                window.showErrorMessage((<Error>error).message);
            }
        } else {
            window.showWarningMessage("ioBroker: Cannot start current script.");
        }
    }

    private tryGetScriptId(...args: any[]): ScriptId | null {
        if (args && args[0] && args[0].length > 0) {
            return (<ScriptItem>args[0][0]).script._id;
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return this.scriptIdService.getIoBrokerId(activeDocument.uri);
        }

        return null;
    }
}
