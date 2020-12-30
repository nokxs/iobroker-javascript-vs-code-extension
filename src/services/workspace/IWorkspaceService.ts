import { WorkspaceFolder } from "vscode";

export interface IWorkspaceService {
    getWorkspaceToUse(): Promise<WorkspaceFolder>;
}
