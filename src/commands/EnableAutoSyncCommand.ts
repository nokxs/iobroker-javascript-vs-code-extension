import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptExplorerProvider } from "../views/scriptExplorer/IScriptExplorerProvider";
import { ICommand } from "./ICommand";

@injectable()
export class EnableAutoSyncCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.enableAutoSync";

    constructor(
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: IScriptExplorerProvider,
    ) {}

    async execute(): Promise<void> {
        await this.scriptExplorerProvider.setAutoRevealEnabled(true);
        await this.scriptExplorerProvider.revealCurrentScript();
    }
}
