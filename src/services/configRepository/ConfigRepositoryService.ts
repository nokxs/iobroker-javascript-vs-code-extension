import { Config, NoConfig } from "../../models/Config";
import { Uri, WorkspaceFolder, window, workspace } from "vscode";

import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IFileService } from '../file/IFileService';
import { IConfigRepositoryService as IConfigRepositoryService } from "./IConfigRepositoryService";

@injectable()
export class ConfigRepositoryService implements IConfigRepositoryService {
    
    config: Config = new NoConfig();

    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
    ) {}

    async read(workspaceFolder: WorkspaceFolder): Promise<Config> {
        const expectedConfigFilePath = this.getConfigPath(workspaceFolder.uri);
        const configFileExists = this.fileService.fileExists(expectedConfigFilePath);
        
        if (configFileExists) {
            const configFileContent = await workspace.fs.readFile(expectedConfigFilePath);
            this.config = JSON.parse(configFileContent.toString(), (key: string, value: any) => {
                if (key === "adminVersion") {
                    return (<string>value).toLocaleLowerCase();
                }

                return value;
            });
        } else {
            this.config = new NoConfig();
        }

        return this.config;
    }

    async write(config: Config, workspaceFolder: WorkspaceFolder): Promise<void> {
        if (workspace.workspaceFolders) {            
            const configPath = this.getConfigPath(workspaceFolder.uri);
            this.fileService.saveToFile(configPath, JSON.stringify(config, null, 2));
            this.config = config;
        } else {
            window.showWarningMessage("Cannot save config. No workspace available. Please open a directory to start with iobroker-javascript.");
        }
    }

    private getConfigPath(root: Uri) {
        return Uri.joinPath(root, ".iobroker-config.json");
    }
}
