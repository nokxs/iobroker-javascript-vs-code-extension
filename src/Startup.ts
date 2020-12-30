import { IStartup } from "./IStartup";
import { inject, injectable } from "inversify";
import TYPES from "./Types";
import { ICommandService } from "./services/command/ICommandService";
import { IConfigService } from "./services/config/IConfigService";
import { NoWorkspaceFolder } from "./models/NoWorkspaceFolder";
import { ExtensionContext, Uri, window } from "vscode";
import { Config, NoConfig } from "./models/Config";
import { IConnectionService } from "./services/connection/IConnectionService";
import { IWorkspaceService } from "./services/workspace/IWorkspaceService";

@injectable()
export class Startup implements IStartup {
    constructor(
        @inject(TYPES.services.command) private commandService: ICommandService,
        @inject(TYPES.services.config) private configService: IConfigService,
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {
        
    }

    async init(context: ExtensionContext): Promise<void> {
        this.commandService.registerCommands(context);

        var workspaceFolder = await this.workspaceService.getWorkspaceToUse();
    
        if (workspaceFolder instanceof NoWorkspaceFolder) {
            window.showErrorMessage("Cannot continue execution of extension 'ioBroker.javascript', because no valid workspace was selected. Exiting.");
            return;
        }
    
        var config: Config = await this.configService.read(workspaceFolder);
        if (config instanceof NoConfig) {
            config = await this.configService.createConfigInteractivly();
            if (config) {
                await this.configService.write(config, workspaceFolder);
            }
        }
    
        await this.connectionService.connect(Uri.parse(`${config.ioBrokerUrl}:${config.socketIoPort}`));
    }

}