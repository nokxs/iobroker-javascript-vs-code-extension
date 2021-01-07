import { Config, NoConfig } from "../../models/Config";
import { Uri, WorkspaceFolder, window, workspace } from "vscode";

import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IFileService } from '../file/IFileService';
import { IConfigReaderWriterService } from "./IConfigReaderWriterService";

@injectable()
export class ConfigReaderWriterService implements IConfigReaderWriterService {
    
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
    ) {}

    async read(workspaceFolder: WorkspaceFolder): Promise<Config> {
        
        const expectedConfigFilePath = this.getConfigPath(workspaceFolder.uri);
        const configFileExists = this.fileService.fileExists(expectedConfigFilePath);
        
        if (configFileExists) {
            const configFileContent = await workspace.fs.readFile(expectedConfigFilePath);
            const config = JSON.parse(configFileContent.toString());
            return config;
        }

        return new NoConfig();
    }

    async write(config: Config, workspaceFolder: WorkspaceFolder): Promise<void> {
        if (workspace.workspaceFolders) {            
            const configPath = this.getConfigPath(workspaceFolder.uri);
            const writeData = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
            workspace.fs.writeFile(configPath, writeData);
        } else {
            window.showWarningMessage("Cannot save config. No workspace available. Please open a directory to start with iobroker-javascript.");
        }
    }

    private getConfigPath(root: Uri) {
        return Uri.joinPath(root, ".iobroker-config.json");
    }
}
