import { IStartup } from "./IStartup";
import { inject, injectable } from "inversify";
import TYPES from "./Types";
import { ICommandService } from "./services/command/ICommandService";
import { CancellationToken, CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position, TextDocument, window } from "vscode";
import { ScriptExplorerProvider } from "./views/scriptExplorer/ScriptExplorerProvider";
import { IIobrokerConnectionService } from "./services/iobrokerConnection/IIobrokerConnectionService";
import { IWorkspaceService } from "./services/workspace/IWorkspaceService";
import { ChangedScriptsProvider as ChangedScriptsProvider } from "./views/changedScripts/ChangedScriptsProvider";
import { IConfigRepositoryService } from "./services/configRepository/IConfigRepositoryService";
import { IDebugLogService } from "./services/debugLogService/IDebugLogService";
import { IStateRemoteService } from "./services/stateRemote/IStateAndObjectRemoteService";
import { StateRemoteService } from "./services/stateRemote/StateAndObjectRemoteService";

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
        @inject(TYPES.services.StateAndObjectRemoteService) private stateRemoteService: IStateRemoteService,
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

        const statRemoteService = this.stateRemoteService;
        languages.registerHoverProvider('javascript', {
            async provideHover(document, position, token) {
                const states = await statRemoteService.getAllObjects();
                const wordRange = document.getWordRangeAtPosition(position, /".*\.[0-9]\..*"/);
                if (wordRange) {
                    return { contents: [document.getText(wordRange)] };
                }

                return undefined;
            }
        });



        // class GoCompletionItemProvider implements CompletionItemProvider {
        //     public provideCompletionItems(
        //         document: TextDocument, position: Position):
        //         Promise<CompletionItem[]> | undefined {
        //         const wordRange = document.getWordRangeAtPosition(position, /".*\.[0-9]\..*"/);
        //         if (wordRange) {
        //             const text  = document.getText(wordRange);
        //             return new Promise<CompletionItem[]>((resolve) => {
        //                 resolve([{label: text, detail: "Test"}]);
        //             });
        //         }

        //         return undefined;
        //     }
        // }

        // const provider = new GoCompletionItemProvider();
        // languages.registerCompletionItemProvider("javascript", provider, '"', "'", "#");
    }
}
