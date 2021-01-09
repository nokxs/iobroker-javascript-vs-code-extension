import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import CONSTANTS from "../Constants";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}
    
    async execute() {
        const message = window.setStatusBarMessage("ioBroker: Downloading all scripts...");
        const scripts = await this.connectionService.downloadAllScripts();

        await this.scriptService.saveAllToFile(scripts);
        
        message.dispose();
        window.setStatusBarMessage("ioBroker: Finished downloading all scripts", CONSTANTS.StatusBarMessageTime);
    }
}
