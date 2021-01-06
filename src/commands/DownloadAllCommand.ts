import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { IScriptService } from "../services/script/IScriptService";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute() {
        const message = window.setStatusBarMessage("ioBroker: Downloading all scripts...");
        const scripts = await this.connectionService.downloadAllScripts();
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        await this.scriptService.saveAllToFile(scripts, workspaceFolder);
        
        message.dispose();
        window.setStatusBarMessage("ioBroker: Finished downloading all scripts", 10 * 1000);
    }
}
