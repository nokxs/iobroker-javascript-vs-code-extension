import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import CONSTANTS from "../Constants";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { ILocalScript } from "../models/ILocalScript";

@injectable()
export class DownloadCommand implements ICommand {
    id: string = "iobroker-javascript.download";

    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
    ) {}
    
    async execute(...args: any[]) {
        await this.scriptRepositoryService.updateFromServer();
        const localScript = await this.tryGetLocalScript(args);

        if (localScript) {
            await this.scriptService.saveToFile(localScript);            
            window.setStatusBarMessage(`ioBroker: Finished downloading script`, CONSTANTS.StatusBarMessageTime);   
        } else {
            window.showWarningMessage("ioBroker: Could not download script.");
        }
    }

    private tryGetLocalScript(...args: any[]): ILocalScript | undefined {

        if (args && args[0] && args[0].length > 0) {
            const id = (<ScriptItem>args[0][0]).script._id;
            return this.scriptRepositoryService.getScriptFromId(id);
        }
        
        const activeDocument = window.activeTextEditor?.document;
        if (activeDocument) {
            return this.scriptRepositoryService.getScriptFromAbsolutUri(activeDocument.uri);
        }

        return undefined;
    }
}
