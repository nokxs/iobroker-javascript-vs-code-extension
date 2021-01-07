import { WorkspaceFolder, window, workspace } from "vscode";

import { IWorkspaceService } from "./IWorkspaceService";
import { NoWorkspaceFolder } from "../../models/NoWorkspaceFolder";
import { injectable } from "inversify";

@injectable()
export class WorkspaceService implements IWorkspaceService {
    private workspaceToUse: WorkspaceFolder = new NoWorkspaceFolder();
    
    // constructor(
    //     @inject(TYPES.services.config) private configService: IConfigService,
    // ) {}

    async getWorkspaceToUse(): Promise<WorkspaceFolder> {
        if (this.workspaceToUse instanceof NoWorkspaceFolder) {
            this.workspaceToUse = await this.getWorkspaceToUseInternal();            
        }
        
        return this.workspaceToUse;
    }

    async getWorkspacesWithConfig(): Promise<WorkspaceFolder[]> {
        const workspaceFolders = new Array<WorkspaceFolder>();
        
        // if (workspace.workspaceFolders) {
        //     for (const wsf of workspace.workspaceFolders) {
        //         const config = await this.configService.read(wsf);
                
        //         if (!(config instanceof NoConfig)) {
        //             workspaceFolders.push(wsf);
        //         }   
        //     }
        // }

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
