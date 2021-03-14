import { Config } from "../../models/Config";
import { WorkspaceFolder } from "vscode";

export interface IConfigRepositoryService {
    config: Config

    read(workspaceFolder: WorkspaceFolder): Promise<Config>
    write(config: Config, workspaceFolder: WorkspaceFolder): Promise<void>
}
