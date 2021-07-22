import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { IScriptService } from "../services/script/IScriptService";
import { Uri, window } from "vscode";
import { EngineType } from "../models/EngineType";

@injectable()
export class CreateTypeScriptFileCommandy implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createTypeScriptFile";

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
                if (fileName.endsWith(".ts")) {
                    fileName = fileName.substring(0, fileName.lastIndexOf(".ts"));
                }

                const script = this.scriptService.getDefaultScript(`${scriptDirectory.directory._id}.${fileName}`, EngineType.typescript);
                this.scriptRemoteService.uploadScript(script);

                const fileUri = Uri.joinPath(scriptDirectory.directory.absoluteUri, `${fileName}.ts`);
                await this.fileService.saveToFile(fileUri, "");
            }
        }
    }
}
