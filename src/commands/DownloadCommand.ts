import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { IScriptService } from "../services/script/IScriptService";
import { Script } from "../models/Script";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";

@injectable()
export class DownloadCommand implements ICommand {
    id: string = "iobroker-javascript.download";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute(...args: any[]) {
        const script = await this.tryDownloadScript(args);

        if (script) {
            const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
    
            await this.scriptService.saveToFile(script, workspaceFolder);
            
            window.setStatusBarMessage(`ioBroker: Finished downloading script`, CONSTANTS.StatusBarMessageTime);
        } else {
            window.showWarningMessage("ioBroker: Could not download script.");
        }
    }

    private async tryDownloadScript(...args: any[]): Promise<Script | null> {
        if (args && args[0] && args[0].length > 0) {
            const scriptId = (<ScriptItem>args[0][0]).script._id;
            return await this.connectionService.downloadScriptWithId(scriptId);
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return await this.connectionService.downloadScriptWithUri(activeDocument.uri);
        }

        return null;
    }
}
