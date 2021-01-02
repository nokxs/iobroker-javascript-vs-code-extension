import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IFileService } from "../services/file/IFileService";
import { window } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";

@injectable()
export class DownloadCurrentCommand implements ICommand {
    id: string = "iobroker-javascript.downloadCurrent";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute(...args: any[]) {
        const activeDocument = window.activeTextEditor?.document;

        if (activeDocument) {
            const message = window.setStatusBarMessage("ioBroker: Downloading script...");
            const script = await this.connectionService.downloadScriptWithUri(activeDocument.uri);
            const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
    
            await this.fileService.saveToFile(script, workspaceFolder);
            
            message.dispose();
            window.setStatusBarMessage(`ioBroker: Finished downloading script`, 10 * 1000);
        } else {
            window.showWarningMessage("ioBroker: Could not download current  script, because no script is active in editor.");
        }
    }

}