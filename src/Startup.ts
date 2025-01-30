import { IStartup } from "./IStartup";
import { inject, injectable } from "inversify";
import TYPES from "./Types";
import { ICommandService } from "./services/command/ICommandService";
import { CodeActionKind, ExtensionContext, languages, window } from "vscode";
import { ScriptExplorerProvider } from "./views/scriptExplorer/ScriptExplorerProvider";
import { IIobrokerConnectionService } from "./services/iobrokerConnection/IIobrokerConnectionService";
import { IWorkspaceService } from "./services/workspace/IWorkspaceService";
import { ChangedScriptsProvider as ChangedScriptsProvider } from "./views/changedScripts/ChangedScriptsProvider";
import { IConfigRepositoryService } from "./services/configRepository/IConfigRepositoryService";
import { IDebugLogService } from "./services/debugLogService/IDebugLogService";
import { IIobrokerHoverProvider } from "./providers/IIobrokerHoverProvider";
import { IIobrokerCompletionItemProvider } from "./providers/IIobrokerCompletionItemProvider";
import { IIobrokerCodeActionItemProvider } from "./providers/IIoBrokerCodeActionsProvider";

@injectable()
export class Startup implements IStartup {
    constructor(
        @inject(TYPES.services.command) private commandService: ICommandService,
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.workspace) private workSpaceService: IWorkspaceService,
        @inject(TYPES.views.scriptExplorer) private scriptExplorerProvider: ScriptExplorerProvider,
        @inject(TYPES.views.changedScripts) private changedScriptsProvider: ChangedScriptsProvider,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,
        @inject(TYPES.providers.iobrokerHoverProvider) private hoverProvider: IIobrokerHoverProvider,
        @inject(TYPES.providers.iobrokerCompletionItemProvider) private completionItemProvider: IIobrokerCompletionItemProvider,
        @inject(TYPES.providers.iobrokerCodeActionsItemProvider) private codeActionsProvider: IIobrokerCodeActionItemProvider
    ) { }

    async init(context: ExtensionContext): Promise<void> {
        this.commandService.registerCommands(context);

        const workspacesWithConfig = await this.workSpaceService.getWorkspacesWithConfig();
        if (workspacesWithConfig.length === 1) {
            const config = await this.configRepositoryService.read(workspacesWithConfig[0]);
            if (config.collectDebugLog) {
                this.debugLogService.startCollecting();
            }

            await this.iobrokerConnectionService.connect();
        } else if (workspacesWithConfig.length > 1) {
            window.setStatusBarMessage("ioBroker: No auto connect possible. Multiple 'iobroker-config.json' found.");
        }

        window.registerTreeDataProvider("iobroker-javascript.script-explorer", this.scriptExplorerProvider);
        window.registerTreeDataProvider("iobroker-javascript.changed-scripts", this.changedScriptsProvider);

        languages.registerHoverProvider({language: "javascript"}, this.hoverProvider);
        languages.registerHoverProvider({language: "typescript"}, this.hoverProvider);

        languages.registerCompletionItemProvider({language: "javascript"}, this.completionItemProvider, ".");
        languages.registerCompletionItemProvider({language: "typescript"}, this.completionItemProvider, ".");

        context.subscriptions.push(languages.registerCodeActionsProvider({language: "javascript"}, this.codeActionsProvider, { providedCodeActionKinds: [CodeActionKind.RefactorRewrite] }));
        context.subscriptions.push(languages.registerCodeActionsProvider({language: "typescript"}, this.codeActionsProvider, { providedCodeActionKinds: [CodeActionKind.RefactorRewrite] }));
    }
}
