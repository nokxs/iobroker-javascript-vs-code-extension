import { IStartup } from "./IStartup";
import { inject, injectable } from "inversify";
import TYPES from "./Types";
import { ICommandService } from "./services/command/ICommandService";
import { ExtensionContext, window } from "vscode";
import { ScriptExplorerProvider } from "./views/scriptExplorer/ScriptExplorerProvider";
import { IIobrokerConnectionService } from "./services/iobrokerConnection/IIobrokerConnectionService";
import { IWorkspaceService } from "./services/workspace/IWorkspaceService";
import { ChangedFilesProvider } from "./views/changedFiles/ChangedFilesProvider";

@injectable()
export class Startup implements IStartup {
    constructor(
        @inject(TYPES.services.command) private commandService: ICommandService,
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.workspace) private workSpaceService: IWorkspaceService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider,
        @inject(TYPES.views.changedFiles) private changedFilesProvider: ChangedFilesProvider
    ) {}

    async init(context: ExtensionContext): Promise<void> {
        this.commandService.registerCommands(context);
        
        const workspacesWithConfig = await this.workSpaceService.getWorkspacesWithConfig();
        if (workspacesWithConfig.length === 1) {
            await this.iobrokerConnectionService.connect();
        } else if (workspacesWithConfig.length > 1) {
            window.setStatusBarMessage("ioBroker: No auto connect possible. Multiple 'iobroker-config.json' found.");
        }
        
        window.registerTreeDataProvider("iobroker-javascript.script-explorer", this.scriptExplorerProvider);
        window.registerTreeDataProvider("iobroker-javascript.changed-files", this.changedFilesProvider);
    }
}
