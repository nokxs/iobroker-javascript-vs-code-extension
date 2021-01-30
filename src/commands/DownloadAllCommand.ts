import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import CONSTANTS from "../Constants";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}
    
    async execute() {
        const message = window.setStatusBarMessage("ioBroker: Downloading all scripts...");
        const scripts = await this.scriptRemoteService.downloadAllScripts();

        await this.scriptService.saveAllToFile(scripts);
        
        message.dispose();
        window.setStatusBarMessage("ioBroker: Finished downloading all scripts", CONSTANTS.StatusBarMessageTime);
    }
}
