import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import CONSTANTS from "../Constants";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class DownloadAllCommand implements ICommand {
    id: string = "iobroker-javascript.downloadAll";

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepository: IScriptRepositoryService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}
    
    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }

        const message = window.setStatusBarMessage("ioBroker: Downloading all scripts...");
        await this.scriptRepository.updateFromServer();
        const scripts = this.scriptRepository.getAllScripts();
        await this.scriptService.saveAllToFile(scripts);
        await this.scriptRepository.evaluateDirtyState();
        
        message.dispose();
        window.setStatusBarMessage("ioBroker: Finished downloading all scripts", CONSTANTS.StatusBarMessageTime);
    }
}
