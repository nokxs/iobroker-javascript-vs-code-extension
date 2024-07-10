import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { window } from "vscode";
import CONSTANTS from "../Constants";
import { IFileService } from "../services/file/IFileService";

@injectable()
export class DeleteScriptCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.deleteScript";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptItem = <ScriptItem>args[0] ?? <ScriptItem>args[0][0];
            const pickResult = await window.showQuickPick(["No", "Yes"], {canPickMany: false, placeHolder: `Delete '${scriptItem.script.ioBrokerScript.common.name}'?`});

            if (pickResult === "Yes") {
                await this.scriptRemoteService.delete(scriptItem.script._id);
                
                if (this.fileService.fileExists(scriptItem.script.absoluteUri)) {
                    this.fileService.delete(scriptItem.script.absoluteUri);
                }

                window.setStatusBarMessage(`Successfully deleted '${scriptItem.script.ioBrokerScript.common.name}'`, CONSTANTS.statusBarMessageTime);
            }
        }
    }
}
