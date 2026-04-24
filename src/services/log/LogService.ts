import * as fs from "fs";
import * as path from "path";
import { inject, injectable } from "inversify";
import { OutputChannel, Uri, window } from "vscode";
import { ILogMessage } from "../../models/ILogMessage";
import { NoConfig } from "../../models/Config";
import TYPES from "../../Types";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { NoWorkspaceFolder } from "../../models/NoWorkspaceFolder";
import { IScriptIdService } from "../scriptId/IScriptIdService";
import { ILogService } from "./ILogService";

@injectable()
export class LogService implements ILogService {
    
    private allOutputChannel: OutputChannel | undefined = undefined;
    private currentScriptOutputChannel: OutputChannel | undefined = undefined;
    private mirrorStream: fs.WriteStream | undefined = undefined;

    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) {}

    async startReceiving(): Promise<void> {
        // get channels to ensure they are created on startup
        this.getAllOutputChannel();
        this.getcurrentScriptOutputChannel();

        await this.stopReceiving();
        await this.openMirrorStreamIfConfigured();
        await this.connectionServiceProvider.getConnectionService().registerForLogs(async message => await this.logCallback(message));
    }
    
    async stopReceiving(): Promise<void> {
        await this.connectionServiceProvider.getConnectionService().unregisterForLogs(async message => await this.logCallback(message));
        this.closeMirrorStream();
    }

    private async logCallback(logMessage: ILogMessage) {
        if (logMessage.from.startsWith("javascript.")) {
            this.logMessageToChannel(logMessage, this.getAllOutputChannel());
            this.appendMirrorLine(this.formatLogMessage(logMessage));

            if (await this.isRelevantMessage(logMessage)) {
                this.logMessageToChannel(logMessage, this.getcurrentScriptOutputChannel());
            }
        }
    }

    private logMessageToChannel(message: ILogMessage, channel: OutputChannel) {
        channel.appendLine(this.formatLogMessage(message));
    }

    private formatLogMessage(message: ILogMessage): string {
        return `${message.severity}: ${message.message}`;
    }

    private async openMirrorStreamIfConfigured(): Promise<void> {
        this.closeMirrorStream();
        const cfg = this.configRepositoryService.config;
        if (!cfg || cfg instanceof NoConfig || !cfg.mirrorIoBrokerJavaScriptLog) {
            return;
        }
        const folder = await this.workspaceService.getWorkspaceToUse();
        if (folder instanceof NoWorkspaceFolder) {
            return;
        }
        const rel = (cfg.ioBrokerLogMirrorRelativePath && cfg.ioBrokerLogMirrorRelativePath.trim() !== "")
            ? cfg.ioBrokerLogMirrorRelativePath.replace(/\\/g, "/")
            : ".iobroker/javascript-live.log";
        const fileUri = Uri.joinPath(folder.uri, rel);
        const parentDir = path.dirname(fileUri.fsPath);
        try {
            fs.mkdirSync(parentDir, { recursive: true });
        } catch (_) {
            /* ignore */
        }
        try {
            this.mirrorStream = fs.createWriteStream(fileUri.fsPath, { flags: "a" });
            this.mirrorStream.on("error", e => {
                window.showWarningMessage(`ioBroker: could not write log mirror file: ${e.message}`);
                this.mirrorStream = undefined;
            });
            const header = `\n######## ${new Date().toISOString()} — ioBroker javascript log mirror started ########\n`;
            this.mirrorStream.write(header);
        } catch (e) {
            window.showWarningMessage(`ioBroker: could not open log mirror file: ${e}`);
            this.mirrorStream = undefined;
        }
    }

    private closeMirrorStream(): void {
        if (this.mirrorStream) {
            try {
                this.mirrorStream.end();
            } catch (_) { /* ignore */ }
            this.mirrorStream = undefined;
        }
    }

    private appendMirrorLine(line: string): void {
        if (!this.mirrorStream) {
            return;
        }
        try {
            this.mirrorStream.write(`${new Date().toISOString()} ${line}\n`);
        } catch (_) { /* ignore write errors */ }
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
