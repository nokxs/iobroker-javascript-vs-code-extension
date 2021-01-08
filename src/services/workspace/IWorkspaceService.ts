import { WorkspaceFolder } from "vscode";

export interface IWorkspaceService {
    workspaceToUse: WorkspaceFolder
    
    getWorkspaceToUse(): Promise<WorkspaceFolder>
    getWorkspacesWithConfig(): Promise<WorkspaceFolder[]>
}
