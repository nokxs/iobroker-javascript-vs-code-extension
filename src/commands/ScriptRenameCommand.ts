import { Uri, window } from "vscode";

import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import TYPES from "../Types";
import { IFileService } from "../services/file/IFileService";
import { IScriptService } from "../services/script/IScriptService";
import { EngineType } from "../models/EngineType";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";

@injectable()
export class ScriptRenameCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.rename";
    
    constructor(
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}

    async execute(...args: any[]) {
        if (args && args[0]) {
            const script = (<ScriptItem>args[0]).script;
            const scriptName = script.common.name;
            const scriptId = script._id;

            const newScriptName = await window.showInputBox({prompt: "The new name of the script.", value: scriptName});

            if (newScriptName) {
                await this.scriptRemoteService.rename(scriptId, newScriptName);
                
                const oldPath = await this.scriptService.getFileUri(script);
                
                const fileExtension = this.scriptService.getFileExtension(<EngineType>script.common.engineType ?? EngineType.unkown);
                const splittedPath = oldPath.path.split("/");
                splittedPath.splice(-1,1);
                splittedPath.push(`${newScriptName}.${fileExtension}`);
                const newPath = Uri.file(splittedPath.join("/"));

                await this.fileService.rename(oldPath, newPath);
            }
        } else {
            window.showInformationMessage("This command can only be invoked over the script explorer!");
        }
    }
}
