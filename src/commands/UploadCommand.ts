import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import { IConnectionService } from "../services/connection/IConnectionService";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { Script } from "../models/Script";
import { InvalidScript } from "../models/InvalidScript";
import { EngineType } from "../models/EngineType";

@injectable()
export class UploadCommand implements ICommand {
    id: string = "iobroker-javascript.upload";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService
    ) {}

    async execute(...args: any[]) {
        const scriptData = await this.getScriptData(args);

        if (scriptData) {
            if (scriptData.existingScript instanceof InvalidScript) {
                // TODO: Script does not exist. What to do?
            } else {
                scriptData.existingScript.common.source = scriptData.scriptText;
                await this.connectionService.uploadScript(scriptData.existingScript);
            }
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
            const existingScript = await this.connectionService.downloadScriptWithUri(fileUri);
            
            return {
                scriptText: scriptText,
                existingScript: existingScript
            };
        }

        return null;
    }
}
