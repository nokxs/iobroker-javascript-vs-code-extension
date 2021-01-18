import * as path from 'path';

import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import { IConnectionService } from "../services/connection/IConnectionService";
import TYPES from "../Types";
import { Uri, window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { Script } from "../models/Script";
import { EngineType } from "../models/EngineType";
import CONSTANTS from "../Constants";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";

@injectable()
export class UploadCommand implements ICommand {
    id: string = "iobroker-javascript.upload";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService
    ) {}

    async execute(...args: any[]) {
        const scriptData = await this.getScriptData(args);

        if (scriptData) {
            scriptData.existingScript.common.source = scriptData.scriptText;
            await this.connectionService.uploadScript(scriptData.existingScript);
            window.setStatusBarMessage(`ioBroker: Finished uploading script`, CONSTANTS.StatusBarMessageTime);
        }
    }

    private async getScriptData(...args: any[]): Promise<{ scriptText: string, existingScript: Script} | null> {
        if (args && args[0] && args[0].length > 0) {
            const script = (<ScriptItem>args[0][0]).script;
            const scriptId = script._id;
            const engineType = <EngineType>script.common.engineType;
            const scriptText = await this.scriptService.getFileContentOnDisk(scriptId, engineType ?? EngineType.unkown);
            const existingScript = await this.connectionService.downloadScriptWithId(scriptId);
            
            if (scriptText) {
                return {
                    scriptText: scriptText,
                    existingScript: existingScript
                };   
            }
        } else if (window.activeTextEditor) {
            const scriptText = window.activeTextEditor.document.getText();
            const fileUri = window.activeTextEditor.document.uri;
            let existingScript = await this.connectionService.downloadScriptWithUri(fileUri);

            if (!existingScript) {
                // TODO: Support multiple js engines
                existingScript = {
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
            
            return {
                scriptText: scriptText,
                existingScript: existingScript
            };
        }

        return null;
    }

    private getFileName(uri: Uri): string {
        var extension = path.extname(uri.fsPath);
        return path.basename(uri.fsPath, extension);
    }
}
