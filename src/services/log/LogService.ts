import { inject, injectable } from "inversify";
import { OutputChannel, Uri, window } from "vscode";
import { ILogMessage } from "../../models/ILogMessage";
import TYPES from "../../Types";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { IScriptIdService } from "../scriptId/IScriptIdService";
import { ILogService } from "./ILogService";

@injectable()
export class LogService implements ILogService {
    
    private allOutputChannel: OutputChannel | undefined = undefined;
    private currentScriptOutputChannel: OutputChannel | undefined = undefined;

    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
    ) {}

    async startReceiving(): Promise<void> {
        // get channels to ensure they are created on startup
        this.getAllOutputChannel();
        this.getcurrentScriptOutputChannel();

        await this.stopReceiving();
        await this.connectionServiceProvider.getConnectionService().registerForLogs(this.logCallback);
    }
    
    async stopReceiving(): Promise<void> {
        await this.connectionServiceProvider.getConnectionService().unregisterForLogs(this.logCallback);
    }

    private async logCallback(logMessage: ILogMessage) {
        if (logMessage.from.startsWith("javascript.")) {
            this.logMessageToChannel(logMessage, this.getAllOutputChannel());

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
        return logMessage.message.includes(scriptId);
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
