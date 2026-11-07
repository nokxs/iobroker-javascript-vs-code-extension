import * as vscode from "vscode";
import { ExtensionContext, RelativePattern, WorkspaceFolder, window, workspace } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import CONSTANTS from "../../Constants";
import { Config, NoConfig } from "../../models/Config";
import { createTools } from "../../aiTools/tools";
import { ToolDeps } from "../../aiTools/core/types";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IIobrokerConnectionService } from "../iobrokerConnection/IIobrokerConnectionService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IScriptService } from "../script/IScriptService";
import { IScriptCreationService } from "../scriptCreation/IScriptCreationService";
import { IScriptIdService } from "../scriptId/IScriptIdService";
import { IScriptFileService } from "../scriptFile/IScriptFileService";
import { IJsInstanceService } from "../jsInstanceService/IJsInstanceService";
import { IStateAndObjectRemoteService } from "../stateRemote/IStateAndObjectRemoteService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { ScriptExplorerProvider } from "../../views/scriptExplorer/ScriptExplorerProvider";
import { IAiToolService } from "./IAiToolService";

const CONFIG_FILE_NAME = ".iobroker-config.json";

@injectable()
export class AiToolService implements IAiToolService {
    constructor(
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptCreationService) private scriptCreationService: IScriptCreationService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.scriptFile) private scriptFileService: IScriptFileService,
        @inject(TYPES.services.jsInstance) private jsInstanceService: IJsInstanceService,
        @inject(TYPES.services.stateAndObjectRemoteService) private stateAndObjectRemoteService: IStateAndObjectRemoteService,
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider
    ) {}

    registerTools(context: ExtensionContext): void {
        // `vscode.lm` does not exist before VS Code 1.95. The engines field prevents older
        // versions from installing this version, but an already installed one is not upgraded.
        const lm = vscode.lm as typeof vscode.lm | undefined;
        if (!lm) {
            return;
        }

        const deps = this.createDeps();
        for (const tool of createTools(deps, () => this.isEnabled(), () => this.scriptExplorerProvider.refresh())) {
            context.subscriptions.push(lm.registerTool(tool.name, tool));
        }
    }

    async initialize(context: ExtensionContext): Promise<void> {
        const workspacesWithConfig = await this.workspaceService.getWorkspacesWithConfig();
        if (workspacesWithConfig.length !== 1) {
            this.updateContext(false);
            return;
        }

        const workspaceFolder = workspacesWithConfig[0];
        const config = await this.configRepositoryService.read(workspaceFolder);
        this.updateContext(isAiToolsEnabled(config));
        context.subscriptions.push(this.createConfigWatcher(workspaceFolder));
    }

    isEnabled(): boolean {
        return isAiToolsEnabled(this.configRepositoryService.config);
    }

    updateContext(enabled: boolean): void {
        void vscode.commands.executeCommand("setContext", CONSTANTS.contexts.aiToolsEnabled, enabled);
    }

    async toggle(): Promise<void> {
        const workspacesWithConfig = await this.workspaceService.getWorkspacesWithConfig();
        if (workspacesWithConfig.length !== 1) {
            window.showWarningMessage("ioBroker: Cannot change the MCP server setting, because no valid ioBroker configuration was found.");
            return;
        }

        const config = this.configRepositoryService.config;
        if (config instanceof NoConfig) {
            window.showWarningMessage("ioBroker: Cannot change the MCP server setting, because no valid ioBroker configuration was found.");
            return;
        }

        const enabled = !isAiToolsEnabled(config);
        const updatedConfig: Config = { ...config, aiTools: enabled };
        await this.configRepositoryService.write(updatedConfig, workspacesWithConfig[0]);
        this.updateContext(enabled);

        window.setStatusBarMessage(`ioBroker: MCP server ${enabled ? "enabled" : "disabled"}`, CONSTANTS.statusBarMessageTime);
    }

    private createDeps(): ToolDeps {
        return {
            connection: this.iobrokerConnectionService,
            scripts: this.scriptRepositoryService,
            scriptRemote: this.scriptRemoteService,
            script: this.scriptService,
            scriptCreation: this.scriptCreationService,
            scriptId: this.scriptIdService,
            files: this.scriptFileService,
            jsInstances: this.jsInstanceService,
            states: this.stateAndObjectRemoteService,
            logs: {
                getHosts: async () => {
                    const hosts = await this.connectionServiceProvider.getConnectionService()
                        .getSystemObjectView<{ _id: string, common?: { name?: string, installedVersion?: string } }>("host", "system.host", "system.host.");
                    return hosts.map(host => ({
                        id: host._id,
                        name: host.common?.name ?? host._id.replace(/^system\.host\./, ""),
                        controllerVersion: host.common?.installedVersion
                    }));
                },
                searchLogs: (hostId, options) =>
                    this.connectionServiceProvider.getConnectionService().searchLogs(hostId, options)
            },
            documents: {
                isDirty: (filePath: string) => workspace.textDocuments.some(document => document.isDirty && document.uri.fsPath === filePath)
            }
        };
    }

    /**
     * The flag is read from `.iobroker-config.json` on startup only, so editing the file by hand
     * would otherwise require reloading the window.
     */
    private createConfigWatcher(workspaceFolder: WorkspaceFolder): vscode.FileSystemWatcher {
        const watcher = workspace.createFileSystemWatcher(new RelativePattern(workspaceFolder, CONFIG_FILE_NAME));

        const reload = () => {
            void this.reloadFromDisk(workspaceFolder);
        };

        watcher.onDidChange(reload);
        watcher.onDidCreate(reload);
        watcher.onDidDelete(reload);

        return watcher;
    }

    private async reloadFromDisk(workspaceFolder: WorkspaceFolder): Promise<void> {
        try {
            const config = await this.configRepositoryService.read(workspaceFolder);
            this.updateContext(isAiToolsEnabled(config));
        } catch (error) {
            window.showWarningMessage(`ioBroker: Could not read ${CONFIG_FILE_NAME}. ${error instanceof Error ? error.message : ""}`);
        }
    }
}

function isAiToolsEnabled(config: Config): boolean {
    return !(config instanceof NoConfig) && config.aiTools === true;
}
