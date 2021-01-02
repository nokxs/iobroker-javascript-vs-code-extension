import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";

@injectable()
export class StopCurrentScriptCommand implements ICommand {
    id: string = "iobroker-javascript.stopCurrentScript";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}
    
    async execute(...args: any[]) {
        const activeDocument = window.activeTextEditor?.document;

        if (activeDocument) {
            const scriptId = await this.scriptService.getIoBrokerId(activeDocument.uri);

            if (scriptId.length > 0) {
                try {
                    await this.connectionService.stopScript(scriptId);
                    window.setStatusBarMessage(`ioBroker: Stoped script '${scriptId}' sucessfully`);
                } catch (error) {
                    window.showErrorMessage((<Error>error).message);
                }
            }
        } else {
            window.showWarningMessage("ioBroker: Cannot stop current script, because no script file is openend.");
        }
    }    
}
