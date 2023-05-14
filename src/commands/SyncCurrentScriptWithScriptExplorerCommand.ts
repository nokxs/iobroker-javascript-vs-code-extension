import { inject, injectable } from "inversify";
import { window } from "vscode";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import TYPES from "../Types";
import { IScriptExplorerProvider } from "../views/scriptExplorer/IScriptExplorerProvider";
import { ICommand } from "./ICommand";

@injectable()
export class SyncCurrentScriptWithScriptExplorerCommand implements ICommand {
    id: string = "iobroker-javascript.syncCurrentScriptWithScriptExplorer";
    
    constructor(
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: IScriptExplorerProvider,
    ) {}
    
    async execute() {
        const fileUri = window.activeTextEditor?.document.uri;
        if (fileUri) {
            const script = this.scriptRepositoryService.getScriptFromAbsolutUri(fileUri);
            if (script) {

                let item  = this.scriptExplorerProvider.getItem(<string>script._id);
                if (item) {
                    this.scriptExplorerProvider.treeView.reveal(item);
                }
            }
        }
    }
}
