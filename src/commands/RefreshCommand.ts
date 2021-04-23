import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptExplorerProvider } from "../views/scriptExplorer/ScriptExplorerProvider";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class RefreshCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.refresh";

    constructor(        
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepository: IScriptRepositoryService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider
    ) {}
    
    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }
        
        await this.scriptRepository.updateFromServer();
        this.scriptExplorerProvider.refresh();
    }
}
