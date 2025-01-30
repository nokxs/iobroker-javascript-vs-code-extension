import * as fs from 'fs';

import DEBUG_LOG_SEVERITY, { IDebugLogService } from "./IDebugLogService";
import { inject, injectable } from "inversify";
import { env, extensions, Uri, version, window } from 'vscode';
import TYPES from '../../Types';
import { IWorkspaceService } from '../workspace/IWorkspaceService';

@injectable()
export class DebugLogService implements IDebugLogService {
    private collecting = false;
    private logFileStream: fs.WriteStream | undefined = undefined;

    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService) {
    }

    async startCollecting(): Promise<void> {
        this.collecting = true;
        this.endLogFileStream();

        const workspaceToUse = await this.workspaceService.getWorkspaceToUse();
        const logFilePath = Uri.joinPath(workspaceToUse.uri, "debug.log");

        this.logFileStream = fs.createWriteStream(logFilePath.fsPath, {flags:'a'});
        this.writeHeaderData();
        window.showInformationMessage(`Start collecting debug log in ${logFilePath.fsPath}...`);
    }

    stopCollecting(): void {
        this.collecting = false;        
        this.endLogFileStream;
        window.showInformationMessage("Stop collecting debug log...");
    }
    
    isCollecting(): boolean {
        return this.collecting;
    }
    
    log(message: string, source?: string, severity?: string): void {
        if (!source) {
            source = "";
        }

        if (!severity) {
            severity = DEBUG_LOG_SEVERITY.info;
        }

        if (this.collecting) {
            this.logFileStream?.write(`${new Date().toISOString()} ${severity} ${source} ${message}\n`);
        }
    }

    logWarning(message: string, source?: string | undefined): void {
        this.log(message, source, DEBUG_LOG_SEVERITY.warning);
    }

    logError(message: string, source?: string | undefined): void {
        this.log(message, source, DEBUG_LOG_SEVERITY.error);
    }

    private endLogFileStream() {
        if (this.logFileStream) {
            this.logFileStream.end();
        }
        this.logFileStream = undefined;
    }

    private writeHeaderData() {
        const extension = extensions.getExtension("nokxs.iobroker-javascript");

        this.logFileStream?.write("#################################\n");
        this.logFileStream?.write(`VSCode Version: ${version}\n`);
        this.logFileStream?.write(`Is new app install: ${env.isNewAppInstall}\n`);
        this.logFileStream?.write(`Is telemetry enabled: ${env.isTelemetryEnabled}\n`);
        this.logFileStream?.write(`Language: ${env.language}\n`);
        this.logFileStream?.write(`App host: ${env.appHost}\n`);
        this.logFileStream?.write(`Is extension active: ${extension?.isActive}\n`);
        this.logFileStream?.write(`Extension version: ${extension?.packageJSON?.version}\n`);
        this.logFileStream?.write(`\n`);
    }
}
