import { StatusBarAlignment, Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import { Config, NoConfig } from '../../models/Config';
import { NoWorkspaceFolder } from '../../models/NoWorkspaceFolder';
import TYPES from '../../Types';
import { IConfigService } from '../config/IConfigService';
import { IConnectionService } from '../connection/IConnectionService';
import { ILogService } from '../log/ILogService';
import { IWorkspaceService } from '../workspace/IWorkspaceService';
import { IIobrokerConnectionService } from "./IIobrokerConnectionService";
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConfigReaderWriterService } from "../configReaderWriter/IConfigReaderWriterService";

@injectable()
export class IobrokerConnectionService implements IIobrokerConnectionService, IConnectionEventListener {

  private statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 250);

  constructor(
      @inject(TYPES.services.config) private configService: IConfigService,
      @inject(TYPES.services.configReaderWriter) private configReaderWriterService: IConfigReaderWriterService,
      @inject(TYPES.services.connection) private connectionService: IConnectionService,
      @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
      @inject(TYPES.services.log) private logService: ILogService
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
        var workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        if (workspaceFolder instanceof NoWorkspaceFolder) {
            window.showErrorMessage("Cannot continue execution of extension 'ioBroker.javascript', because no valid workspace was selected. Exiting.");
            return;
        }
    
        var config: Config = await this.configReaderWriterService.read(workspaceFolder);
        if (config instanceof NoConfig) {
            config = await this.configService.createConfigInteractivly();
            if (config) {
                await this.configReaderWriterService.write(config, workspaceFolder);
            }
        }

        await this.connectionService.connect(Uri.parse(`${config.ioBrokerUrl}:${config.socketIoPort}`));
        await this.logService.startReceiving();
    } catch (error) {
        window.showErrorMessage(`Could not connect to ioBroker. Check your '.iobroker-config.json' for wrong configuration: ${error}`);
    }
  }  
}
