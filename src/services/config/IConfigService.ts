import { Config } from "../../models/config";
import { WorkspaceFolder } from "vscode";

export interface IConfigService {
    read(workspaceFolder: WorkspaceFolder): Promise<Config>
    write(config: Config, workspaceFolder: WorkspaceFolder): Promise<void>
    createConfigInteractivly(): Promise<Config>
    getWorkspaceToUse(): Promise<WorkspaceFolder>
}
