import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ScriptExplorerProvider } from "../views/scriptExplorer/ScriptExplorerProvider";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";

@injectable()
export class RefreshCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.refresh";

    constructor(        
        @inject(TYPES.services.scriptRepository) private scriptRepository: IScriptRepositoryService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider
    ) {}
    
    async execute() {
        await this.scriptRepository.updateFromServer();
        this.scriptExplorerProvider.refresh();
    }
}
