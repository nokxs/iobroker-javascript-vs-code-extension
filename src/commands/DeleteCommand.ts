import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { window } from "vscode";
import CONSTANTS from "../Constants";

@injectable()
export class DeleteCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.delete";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const script = <ScriptItem>args[0] ?? <ScriptItem>args[0][0];
            const pickResult = await window.showQuickPick(["No", "Yes"], {canPickMany: false,placeHolder: `Delete '${script.script.ioBrokerScript.common.name}'?`});

            if (pickResult === "Yes") {
                await this.scriptRemoteService.delete(script.script._id);
                window.setStatusBarMessage(`Successfully deleted '${script.script.ioBrokerScript.common.name}'`, CONSTANTS.StatusBarMessageTime);
            }
        }
    }
}
