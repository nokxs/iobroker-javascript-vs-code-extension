import { WorkspaceFolder, window, workspace } from "vscode";

import { IWorkspaceService } from "./IWorkspaceService";
import { NoWorkspaceFolder } from "../../models/NoWorkspaceFolder";
import { inject, injectable } from "inversify";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { NoConfig } from "../../models/Config";
import TYPES from "../../Types";

@injectable()
export class WorkspaceService implements IWorkspaceService {
    workspaceToUse: WorkspaceFolder = new NoWorkspaceFolder();
    
    constructor(
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
    ) {}

    async getWorkspaceToUse(): Promise<WorkspaceFolder> {
        if (this.workspaceToUse instanceof NoWorkspaceFolder) {
            this.workspaceToUse = await this.getWorkspaceToUseInternal();            
        }
        
        return this.workspaceToUse;
    }

    private async getWorkspaceToUseInternal(): Promise<WorkspaceFolder> {
        return await this.getWorkspaceFromExisting() ?? await this.getNewWorkspace();
    }

    private async getWorkspaceFromExisting(): Promise<WorkspaceFolder | undefined> {
        const workspacesWithConfig = await this.getWorkspacesWithConfig();
        if (workspacesWithConfig.length === 1) {
            return workspacesWithConfig[0];
        } else if (workspacesWithConfig.length > 1) {
            const result = await window.showQuickPick(workspacesWithConfig.map(ws => ws.name), {placeHolder: "Found multiple .iobroker-config.json. Which to use?"});
            if (result) {
                return workspacesWithConfig.filter(ws => ws.name === result)[0];
            }

            return new NoWorkspaceFolder();
        }
    }

    async getWorkspacesWithConfig(): Promise<WorkspaceFolder[]> {
        const workspaceFolders = new Array<WorkspaceFolder>();
        
        if (workspace.workspaceFolders) {
            for (const wsf of workspace.workspaceFolders) {
                const config = await this.configRepositoryService.read(wsf);
                
                if (!(config instanceof NoConfig)) {
                    workspaceFolders.push(wsf);
                }   
            }
        }

        return workspaceFolders;
    }

    private async getNewWorkspace(): Promise<WorkspaceFolder> {
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {            
            if (workspace.workspaceFolders.length >= 2) {
                const pickedWorkspace = await window.showWorkspaceFolderPick({ placeHolder: "Select workspace to save .iobroker-config.json to" });
                return pickedWorkspace ?? new NoWorkspaceFolder();
            } 

            return workspace.workspaceFolders[0];
        }

        return new NoWorkspaceFolder();
    }
}
