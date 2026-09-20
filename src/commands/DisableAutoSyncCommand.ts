import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptExplorerProvider } from "../views/scriptExplorer/IScriptExplorerProvider";
import { ICommand } from "./ICommand";

@injectable()
export class DisableAutoSyncCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.disableAutoSync";

    constructor(
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: IScriptExplorerProvider,
    ) {}

    async execute(): Promise<void> {
        await this.scriptExplorerProvider.setAutoRevealEnabled(false);
    }
}
