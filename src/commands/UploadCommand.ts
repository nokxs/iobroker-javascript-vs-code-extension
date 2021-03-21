import * as path from 'path';

import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { Uri, window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScript } from "../models/IScript";
import CONSTANTS from "../Constants";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";
import { IScriptRemoteService } from '../services/scriptRemote/IScriptRemoteService';

@injectable()
export class UploadCommand implements ICommand {
    id: string = "iobroker-javascript.upload";
    
    constructor(
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService
    ) {}

    async execute(...args: any[]) {
        const script = await this.getScriptData(args);

        if (script) {
            await this.scriptRemoteService.uploadScript(script);
            window.setStatusBarMessage(`ioBroker: Finished uploading script`, CONSTANTS.StatusBarMessageTime);
        } else {
            window.setStatusBarMessage(`ioBroker: Couldn't upload script`, CONSTANTS.StatusBarMessageTime);
        }
    }

    private async getScriptData(...args: any[]): Promise<IScript | null> {
        if (args && args[0] && args[0].length > 0) {
            return this.handleScriptFromScriptExplorer(args);
        } else if (window.activeTextEditor) {
            return this.handleScriptFromEditor();
        }

        return null;
    }

    private getFileName(uri: Uri): string {
        var extension = path.extname(uri.fsPath);
        return path.basename(uri.fsPath, extension);
    }

    private async handleScriptFromScriptExplorer(...args: any[]): Promise<IScript | null> {
        const localScript = (<ScriptItem>args[0])?.script ?? (<ScriptItem>args[0][0])?.script ?? (<ScriptItem>args[0][0][0]).script;
        const script = localScript.ioBrokerScript;
        const scriptName = script.common.name;

        if (!scriptName) {
            throw new Error(`Cannot upload script '${script._id}', because it's name is not set`);
        }

        const scriptText = await this.scriptService.getFileContentOnDisk(localScript);
        const existingScript = await this.scriptRemoteService.downloadScriptWithId(script._id);
        
        if (existingScript) {
            existingScript.common.source = scriptText ?? "";
            return existingScript;
        }

        return null;
    }

    private async handleScriptFromEditor(): Promise<IScript | null> {
        if (window.activeTextEditor) {
            const scriptText = window.activeTextEditor.document.getText();
            const fileUri = window.activeTextEditor.document.uri;
            let script = await this.scriptRemoteService.downloadScriptWithUri(fileUri);
    
            if (script) {
                script.common.source = scriptText;
            } else {
                // TODO: Support multiple js engines
                script = {
                    _id: this.scriptIdService.getIoBrokerId(fileUri),
                    common: {
                        debug: false,
                        engine: "system.adapter.javascript.0",
                        engineType: this.scriptService.getEngineType(fileUri),
                        expert: true,
                        name: this.getFileName(fileUri),
                        source: scriptText,
                        verbose: false
                    },
                    type: "script"
                };
            }
            
            return script;
        }

        return null;
    }
}
