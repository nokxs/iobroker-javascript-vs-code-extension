import { env, StatusBarAlignment, Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import { AdminVersion, Config, NoConfig } from '../../models/Config';
import { NoWorkspaceFolder } from '../../models/NoWorkspaceFolder';
import TYPES from '../../Types';
import { IConnectionService } from '../connection/IConnectionService';
import { ILogService } from '../log/ILogService';
import { IWorkspaceService } from '../workspace/IWorkspaceService';
import { IIobrokerConnectionService } from "./IIobrokerConnectionService";
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import CONSTANTS from "../../Constants";
import { IConfigCreationService } from "../configCreation/IConfigCreationService";
import { IScriptService } from "../script/IScriptService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";

@injectable()
export class IobrokerConnectionService implements IIobrokerConnectionService, IConnectionEventListener {

  config: Config = new NoConfig();

  private statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 250);

  constructor(
      @inject(TYPES.services.configCreation) private configCreationService: IConfigCreationService,
      @inject(TYPES.services.configRepository) private configReaderWriterService: IConfigRepositoryService,
      @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
      @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
      @inject(TYPES.services.log) private logService: ILogService,
      @inject(TYPES.services.script) private scriptService: IScriptService,
      @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
  ) {
    this.statusBarItem.text = "$(warning) ioBroker disconnected";
    this.statusBarItem.show();
    this.connectionServiceProvider.getConnectionService().registerConnectionEventListener(this);
  }

  onConnected(): void {
    this.statusBarItem.text = "$(check) ioBroker connected";
  }

  onDisconnected(): void {
    this.statusBarItem.text = "$(warning) ioBroker disconnected";
  }

  async connect(): Promise<void> {
    try {
        let isInitialConnect = false;
        let workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        if (workspaceFolder instanceof NoWorkspaceFolder) {
            window.showErrorMessage("Cannot continue execution of extension 'ioBroker.javascript', because no valid workspace was selected. Exiting.");
            return;
        }
    
        this.config = await this.configReaderWriterService.read(workspaceFolder);

        if (!this.isConfigValid()) {
          const pickAnswer = await window.showQuickPick(["Yes", "No, open documentation"], {placeHolder: "ioBroker: Your config is missing mandatory items. Recreate config?", ignoreFocusOut: true});
          if(pickAnswer === "Yes") {      
            this.config = new NoConfig();
          }
          else {
            await env.openExternal(Uri.parse("https://github.com/nokxs/iobroker-javascript-vs-code-extension#available-settings"));
            window.showWarningMessage("Connection attempt to ioBroker aborted. Update your config and try again!");
            return;
          }
        }

        if (this.config instanceof NoConfig) {
          this.config = await this.configCreationService.createConfigInteractivly();
          if (this.config instanceof NoConfig) {
            window.showWarningMessage("ioBroker: Config not saved. Execute command 'iobroker: Connect to ioBroker' to start another connection attempt.");
            return;
          }
          else {
              await this.configReaderWriterService.write(this.config, workspaceFolder);
              window.setStatusBarMessage("ioBroker: Created new 'iobroker-config.json' in root directory", CONSTANTS.StatusBarMessageTime);
              isInitialConnect = true;
          }
        }

        await this.connectionServiceProvider.getConnectionService().connect(Uri.parse(`${this.config.ioBrokerUrl}:${this.config.socketIoPort}`));
        await this.logService.startReceiving();
        await this.scriptRepositoryService.init();

        if (isInitialConnect) {
          const answer = await window.showQuickPick(["Yes", "No"], { placeHolder: "Download all scripts"});
          if (answer === "Yes") {
              const scripts = this.scriptRepositoryService.getAllScripts();
              await this.scriptService.saveAllToFile(scripts);
          } 
        }
    } catch (error) {
        window.showErrorMessage(`Could not connect to ioBroker. Check your '.iobroker-config.json' for wrong configuration: ${error}`);
    }
  }

  private isConfigValid(): boolean {
    if (
      !this.config.ioBrokerUrl ||
      !this.config.socketIoPort ||
      !this.config.scriptRoot ||
      !this.config.adminVersion || this.config.adminVersion === AdminVersion.unknown
      ) {
      return false;
    }

    return true;
  }
}
