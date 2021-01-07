import { IStartup } from "./IStartup";
import { inject, injectable } from "inversify";
import TYPES from "./Types";
import { ICommandService } from "./services/command/ICommandService";
import { commands, ExtensionContext, window } from "vscode";
import { ScriptExplorerProvider } from "./views/scriptExplorer/ScriptExplorerProvider";
import { IIobrokerConnectionService } from "./services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class Startup implements IStartup {
    constructor(
        @inject(TYPES.services.command) private commandService: ICommandService,
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider
    ) {}

    async init(context: ExtensionContext): Promise<void> {
        this.commandService.registerCommands(context);
        
        await this.iobrokerConnectionService.connect();
        
        // TODO: Move to own service
        window.registerTreeDataProvider("iobroker-javascript.script-explorer", this.scriptExplorerProvider);
        commands.registerCommand("iobroker-javascript.view.scriptExplorer.refresh", () => this.scriptExplorerProvider.refresh());
    }

    
}
