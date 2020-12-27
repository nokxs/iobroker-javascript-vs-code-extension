import * as fs from 'fs';

import { QuickPickOptions, Uri, WorkspaceFolder, debug, window, workspace } from "vscode";

import { Config } from "../../models/config";
import { IConfigService } from "./IConfigService";
import { injectable } from "inversify";

@injectable()
export class ConfigService implements IConfigService {
    
    async read(): Promise<Config | unknown> {
        
        if (workspace.workspaceFolders) {
            for (const folder of workspace.workspaceFolders) {
                const expectedConfigFilePath = this.getConfigPath(folder.uri);
                const configFileExists = fs.existsSync(expectedConfigFilePath.path);
                
                if (configFileExists) {
                    const configFileContent = await workspace.fs.readFile(expectedConfigFilePath);
                    const config = JSON.parse(configFileContent.toString());
                    return config;
                }
            }          
        } else {
            window.showWarningMessage("Cannot load config. No workspace available. Please open a directory to start with iobroker-javascript.");
        }

        return null;
    }

    async write(config: Config): Promise<void> {
        if (workspace.workspaceFolders) {            
            const workspaceToUse = await this.getWorkspaceForConfigWrite();

            if (workspaceToUse) {
                const configPath = this.getConfigPath(workspaceToUse.uri);
                const writeData = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
                workspace.fs.writeFile(configPath, writeData);
            } else {
                window.showErrorMessage("Couldn't save config, because no valid workspace was selected!");
            }
        } else {
            window.showWarningMessage("Cannot save config. No workspace available. Please open a directory to start with iobroker-javascript.");
        }
    }

    async createConfigInteractivly(): Promise<Config> {
        const ioBrokerUrl = await window.showInputBox({prompt: "The URL to your ioBroker installation", value: "http://iobroker.local"});
        const port = await window.showInputBox({prompt: "The port of the socket.io Adapter", value: "8082"});
        const scriptPath = await window.showInputBox({prompt: "The relative path in your workspace to the scripts", value: "/"});

        if (ioBrokerUrl && port && scriptPath) {
            return new Config(ioBrokerUrl, Number.parseInt(port), scriptPath);            
        }

        window.showWarningMessage("The given information for the configuration was invalid. Creating default configuration");
        return new Config("http://iobroker.local", 8082, "/");
    }

    private getConfigPath(root: Uri) {
        return Uri.joinPath(root, ".iobroker-config.json");
    }

    private async getWorkspaceForConfigWrite() : Promise<WorkspaceFolder | undefined> {
        if (workspace.workspaceFolders) {            
            if (workspace.workspaceFolders.length >= 2) {
                return await window.showWorkspaceFolderPick({ placeHolder: "Select workspace to save .iobroker-config.json to" });    
            }

            const activeDocument = window.activeTextEditor?.document.uri;
            if (activeDocument) {
                return workspace.getWorkspaceFolder(activeDocument);
            }
        }
        
        return undefined;
    }    
}