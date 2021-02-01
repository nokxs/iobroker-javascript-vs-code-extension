import { StatusBarAlignment, Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import { Config, NoConfig } from '../../models/Config';
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
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";

@injectable()
export class IobrokerConnectionService implements IIobrokerConnectionService, IConnectionEventListener {

  config: Config = new NoConfig();

  private statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 250);

  constructor(
      @inject(TYPES.services.configCreation) private configCreationService: IConfigCreationService,
      @inject(TYPES.services.configRepository) private configReaderWriterService: IConfigRepositoryService,
      @inject(TYPES.services.connection) private connectionService: IConnectionService,
      @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
      @inject(TYPES.services.log) private logService: ILogService,
      @inject(TYPES.services.script) private scriptService: IScriptService,
      @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
      @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
  ) {
    this.statusBarItem.text = "$(warning) ioBroker disconnected";
    this.statusBarItem.show();
    this.connectionService.registerConnectionEventListener(this);
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

        await this.connectionService.connect(Uri.parse(`${this.config.ioBrokerUrl}:${this.config.socketIoPort}`));
        await this.logService.startReceiving();
        await this.scriptRepositoryService.init();

        if (isInitialConnect) {
          const answer = await window.showQuickPick(["Yes", "No"], { placeHolder: "Download all scripts"});
          if (answer === "Yes") {
              const scripts = await this.scriptRemoteService.downloadAllScripts();
              await this.scriptService.saveAllToFile(scripts);
          } 
        }
    } catch (error) {
        window.showErrorMessage(`Could not connect to ioBroker. Check your '.iobroker-config.json' for wrong configuration: ${error}`);
    }
  }  
}
