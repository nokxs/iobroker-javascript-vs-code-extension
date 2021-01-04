import * as fs from 'fs';

import { ICommand } from "./ICommand";
import { Script } from "../models/Script";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptService } from "../services/script/IScriptService";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { TextDocument, Uri, window, workspace } from "vscode";

@injectable()
export class OpenFileCommand implements ICommand {
    id: string = "iobroker-javascript.openFile";
        
    
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) {}
    
    async execute(...args: Script[]) {
        if (args.length !== 1) {
            return;
        }

        const script = args[0];
        const relativeScriptPath = this.scriptService.getRelativeFilePathFromScript(script);
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();

        const fileUri = Uri.joinPath(workspaceFolder.uri, relativeScriptPath);
        const document = await this.openDocument(fileUri, script);
        await window.showTextDocument(document);
    }

    private async openDocument(fileUri: Uri, script: Script): Promise<TextDocument> {
        return fs.existsSync(fileUri.fsPath) ? 
            await workspace.openTextDocument(fileUri) : 
            await workspace.openTextDocument({language: this.getScriptLanguage(script), content: script.common.source});
    }

    private getScriptLanguage(script: Script): string {
        switch (script.common.engineType) {
            case "Javascript/js":
                return "javascript";
            case "TypeScript/ts":
                return "typescript";
            case "Blockly":
                return "blockly";
        
            default:
                return "text";
        }
    }
}
