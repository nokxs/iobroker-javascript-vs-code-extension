import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IFileService } from "../services/file/IFileService";
import { IConfigService } from "../services/config/IConfigService";
import { window } from "vscode";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.config) private configService: IConfigService
    ) {}
    
    async execute(...args: any[]) {
        const message = window.setStatusBarMessage("Downloading scripts from iobroker...");
        const scripts = await this.connectionService.downloadAllScripts();
        const workspaceFolder = await this.configService.getWorkspaceToUse();

	    await this.fileService.saveAllToFile(scripts, workspaceFolder);
        
        message.dispose();
        window.setStatusBarMessage("Finished downloading scripts from iobroker", 10 * 1000);
    }

}