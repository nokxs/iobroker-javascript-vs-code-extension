import * as fs from 'fs';

import { Config, NoConfig } from "../../models/Config";
import { Uri, WorkspaceFolder, window, workspace } from "vscode";

import { IConfigService } from "./IConfigService";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { ITypeDefinitionService } from '../typeDefinition/ITypeDefinitionService';

@injectable()
export class ConfigService implements IConfigService {
    
    constructor(
        @inject(TYPES.services.typeDefinition) private typeDefinitionService: ITypeDefinitionService,
    ) {}

    async read(workspaceFolder: WorkspaceFolder): Promise<Config> {
        
        const expectedConfigFilePath = this.getConfigPath(workspaceFolder.uri);
        const configFileExists = fs.existsSync(expectedConfigFilePath.fsPath);
        
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

    async createConfigInteractivly(): Promise<Config> {
        const ioBrokerUrl = await window.showInputBox({prompt: "The URL to your ioBroker installation", value: "http://localhost"});
        const port = await window.showInputBox({prompt: "The port of the socket.io Adapter", value: "8081"});
        const scriptPath = await window.showInputBox({prompt: "The relative path in your workspace to the scripts", value: "/"});
        const shouldCreateTypeDefinitionConfig = await window.showQuickPick(["Yes", "No"], {canPickMany: false, placeHolder: "Configure ioBroker type defintions?"});
        
        if (shouldCreateTypeDefinitionConfig && shouldCreateTypeDefinitionConfig === "Yes") {
            await this.typeDefinitionService.downloadFromGithubAndSave();
            await this.typeDefinitionService.createConfig();
        }

        if (ioBrokerUrl && port && scriptPath) {
            return new Config(ioBrokerUrl, Number.parseInt(port), scriptPath);            
        }

        window.showWarningMessage("The given information for the configuration was invalid. Creating default configuration");
        return new Config("http://localhost", 8081, "/");
    }

    private getConfigPath(root: Uri) {
        return Uri.joinPath(root, ".iobroker-config.json");
    }
}