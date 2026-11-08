import { inject, injectable } from "inversify";
import { OutputChannel, Uri, window } from "vscode";
import { ILogMessage } from "../../models/ILogMessage";
import TYPES from "../../Types";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { NoWorkspaceFolder } from "../../models/NoWorkspaceFolder";
import { IScriptIdService } from "../scriptId/IScriptIdService";
import { ILogMirrorService } from "../logMirror/ILogMirrorService";
import { ILogService } from "./ILogService";

@injectable()
export class LogService implements ILogService {
    
    private allOutputChannel: OutputChannel | undefined = undefined;
    private currentScriptOutputChannel: OutputChannel | undefined = undefined;
    private receiving = false;
    private readonly logCallbackRef = async (message: ILogMessage) => await this.logCallback(message);

    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.logMirror) private logMirrorService: ILogMirrorService,
    ) {}

    async startReceiving(): Promise<void> {
        // get channels to ensure they are created on startup
        this.getAllOutputChannel();
        this.getcurrentScriptOutputChannel();

        await this.stopReceiving();
        await this.openMirrorIfConfigured();
        await this.connectionServiceProvider.getConnectionService().registerForLogs(this.logCallbackRef);
        this.receiving = true;
    }
    
    async stopReceiving(): Promise<void> {
        this.receiving = false;
        await this.connectionServiceProvider.getConnectionService().unregisterForLogs(this.logCallbackRef);
        this.dispose();
    }

    async reopenMirror(): Promise<void> {
        if (!this.receiving) {
            return;
        }
        await this.openMirrorIfConfigured();
    }

    dispose(): void {
        this.logMirrorService.dispose();
    }

    private async openMirrorIfConfigured(): Promise<void> {
        try {
            const folder = await this.workspaceService.getWorkspaceToUse();
            if (folder instanceof NoWorkspaceFolder) {
                return;
            }
            await this.logMirrorService.open(folder);
        } catch (e) {
            // Mirror must never abort connect; LogMirrorService already warns once.
            void e;
        }
    }

    private async logCallback(logMessage: ILogMessage) {
        if (logMessage.from.startsWith("javascript.")) {
            this.logMessageToChannel(logMessage, this.getAllOutputChannel());
            this.logMirrorService.write(logMessage);

            if (await this.isRelevantMessage(logMessage)) {
                this.logMessageToChannel(logMessage, this.getcurrentScriptOutputChannel());
            }
        }
    }

    private logMessageToChannel(message: ILogMessage, channel: OutputChannel) {
        channel.appendLine(`${message.severity}: ${message.message}`);
    }

    private getOpenFileUris(): Uri[] {
        return window.visibleTextEditors?.filter(editor => editor.document.uri.scheme === "file").map(editor => editor.document.uri);
    }

    private async isRelevantMessage(logMessage: ILogMessage): Promise<boolean> {
        const openFileUris = this.getOpenFileUris();
        const relevantMessages = await openFileUris.filter(uri => this.isMessageForFile(logMessage, uri));
        return relevantMessages.length > 0;
    }

    private isMessageForFile(logMessage: ILogMessage, uri: Uri): boolean {
        const scriptId = <string>this.scriptIdService.getIoBrokerId(uri);
        const messageScriptId = LogService.extractScriptIdFromMessage(logMessage.message);
        
        if (!messageScriptId) {
            return false;
        }
        
        return messageScriptId === scriptId;
    }

    /**
     * Extracts the script ID from a log message.
     * Expected format: "javascript.0 (PID) script.name: log content"
     * 
     * @param message The log message to parse
     * @returns The extracted script ID or null if the format is invalid
     */
    public static extractScriptIdFromMessage(message: string): string | null {
        // match is the array result from the regex. match[0] is the full match (e.g., ") script.js.logic.xmas: ")
        // match[1] is the first capture group containing just the script name (e.g., "script.js.logic.xmas")
        const match = message.match(/\)\s+([^:]+):\s+/);
        
        if (!match || !match[1]) {
            return null;
        }
        
        return match[1];
    }

    private getAllOutputChannel(): OutputChannel {
        if (!this.allOutputChannel) {           
            this.allOutputChannel = window.createOutputChannel("ioBroker (all)");
        }

        return this.allOutputChannel;
    }

    private getcurrentScriptOutputChannel(): OutputChannel {
        if (!this.currentScriptOutputChannel) {
            this.currentScriptOutputChannel = window.createOutputChannel("ioBroker (current script)");            
        }

        return this.currentScriptOutputChannel;
    }
}
