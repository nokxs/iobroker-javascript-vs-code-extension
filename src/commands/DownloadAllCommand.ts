import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IFileService } from "../services/file/IFileService";
import { window } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute(...args: any[]) {
        const message = window.setStatusBarMessage("Downloading all scripts from iobroker...");
        const scripts = await this.connectionService.downloadAllScripts();
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();

	    await this.fileService.saveAllToFile(scripts, workspaceFolder);
        
        message.dispose();
        window.setStatusBarMessage("Finished downloading all scripts from iobroker", 10 * 1000);
    }

}