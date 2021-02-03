import { ICommand } from "./ICommand";
import { IScript } from "../models/IScript";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { TextDocument, Uri, window, workspace } from "vscode";
import { IFileService } from '../services/file/IFileService';
import { EngineType } from '../models/EngineType';
import { IScriptService } from "../services/script/IScriptService";
import { ILocalScript } from "../models/ILocalScript";

@injectable()
export class OpenFileCommand implements ICommand {
    id: string = "iobroker-javascript.openFile";
        
    
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.file) private fileService: IFileService,
    ) {}
    
    async execute(...args: ILocalScript[]) {
        if (args && args.length !== 1) {
            return;
        }

        const script = args[0];

        const fileUri = script.fileUri;
        const document = await this.openDocument(fileUri, script.ioBrokerScript);
        await window.showTextDocument(document);
    }

    private async openDocument(fileUri: Uri, script: IScript): Promise<TextDocument> {
        return this.fileService.fileExists(fileUri) ? 
            await workspace.openTextDocument(fileUri) : 
            await workspace.openTextDocument({language: this.getScriptLanguage(script), content: script.common.source});
    }

    private getScriptLanguage(script: IScript): string {
        switch (script.common.engineType?.toLowerCase()) {
            case EngineType.javascript:
                return "javascript";
            case EngineType.typescript:
                return "typescript";
            case EngineType.blockly:
                return "blockly";
        
            default:
                return "text";
        }
    }
}
