import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IFileService } from '../services/file/IFileService';
import { IScriptService } from "../services/script/IScriptService";
import { commands } from "vscode";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { EngineType } from "../models/EngineType";
import { ISecretPlaceholderService } from "../services/scriptRemote/ISecretPlaceholderService";

@injectable()
export class ShowLocalToServerDiffCommand implements ICommand {
    id: string = "iobroker-javascript.view.changed-scripts.showLocalToServerDiff";
        
    
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.secretPlaceholder) private secretPlaceholderService: ISecretPlaceholderService,
    ) {}
    
    async execute(...args: ScriptItem[]) {
        if (args && args.length < 1) {
            return;
        }

        const script = args[0];
        
        const fileExtension = this.scriptService.getFileExtension(<EngineType>script.script.ioBrokerScript.common.engineType);
        const fileName = `${script.script._id.toString()}.${fileExtension}`;
        const normalizedServerSource = await this.secretPlaceholderService.replaceSecretPlaceholdersFromEnvFile(
            script.script.ioBrokerScript.common.source ?? ""
        );
        const serverUri = await this.fileService.createTemporaryFile(fileName, normalizedServerSource);

        const localUri = script.script.absoluteUri;

        commands.executeCommand("vscode.diff", serverUri, localUri);
    }
}
