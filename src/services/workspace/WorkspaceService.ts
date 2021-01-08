import { WorkspaceFolder, window, workspace } from "vscode";

import { IWorkspaceService } from "./IWorkspaceService";
import { NoWorkspaceFolder } from "../../models/NoWorkspaceFolder";
import { inject, injectable } from "inversify";
import { IConfigReaderWriterService } from "../configReaderWriter/IConfigReaderWriterService";
import { NoConfig } from "../../models/Config";
import TYPES from "../../Types";

@injectable()
export class WorkspaceService implements IWorkspaceService {
    workspaceToUse: WorkspaceFolder = new NoWorkspaceFolder();
    
    constructor(
        @inject(TYPES.services.configReaderWriter) private configReaderWriterService: IConfigReaderWriterService,
    ) {}

    async getWorkspaceToUse(): Promise<WorkspaceFolder> {
        if (this.workspaceToUse instanceof NoWorkspaceFolder) {
            this.workspaceToUse = await this.getWorkspaceToUseInternal();            
        }
        
        return this.workspaceToUse;
    }

    async getWorkspacesWithConfig(): Promise<WorkspaceFolder[]> {
        const workspaceFolders = new Array<WorkspaceFolder>();
        
        if (workspace.workspaceFolders) {
            for (const wsf of workspace.workspaceFolders) {
                const config = await this.configReaderWriterService.read(wsf);
                
                if (!(config instanceof NoConfig)) {
                    workspaceFolders.push(wsf);
                }   
            }
        }

        return workspaceFolders;
    }

    private async getWorkspaceToUseInternal(): Promise<WorkspaceFolder> {
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
