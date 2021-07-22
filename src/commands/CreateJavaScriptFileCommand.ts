import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { Uri, window } from "vscode";
import { EngineType } from "../models/EngineType";
import { IScriptService } from "../services/script/IScriptService";

@injectable()
export class CreateJavaScriptFileCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createJavaScriptFile";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];
            let fileName = await window.showInputBox({title: "Enter file name"});
            
            if (fileName) {
                if (fileName.endsWith(".js")) {
                    fileName = fileName.substring(0, fileName.lastIndexOf(".js"));
                }

                const script = this.scriptService.getDefaultScript(`${scriptDirectory.directory._id}.${fileName}`, EngineType.javascript);
                this.scriptRemoteService.uploadScript(script);

                const fileUri = Uri.joinPath(scriptDirectory.directory.absoluteUri, `${fileName}.js`);
                await this.fileService.saveToFile(fileUri, "");
            }
        }
    }
}
