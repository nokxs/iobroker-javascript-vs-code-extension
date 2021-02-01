import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { IScript } from "../models/IScript";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";

@injectable()
export class DownloadCommand implements ICommand {
    id: string = "iobroker-javascript.download";

    constructor(
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}
    
    async execute(...args: any[]) {
        const script = await this.tryDownloadScript(args);

        if (script) {
            await this.scriptService.saveToFile(script);
            
            window.setStatusBarMessage(`ioBroker: Finished downloading script`, CONSTANTS.StatusBarMessageTime);
        } else {
            window.showWarningMessage("ioBroker: Could not download script.");
        }
    }

    private async tryDownloadScript(...args: any[]): Promise<IScript | null> {
        if (args && args[0] && args[0].length > 0) {
            const scriptId = (<ScriptItem>args[0][0]).script._id;
            return await this.scriptRemoteService.downloadScriptWithId(scriptId);
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return await this.scriptRemoteService.downloadScriptWithUri(activeDocument.uri);
        }

        return null;
    }
}
