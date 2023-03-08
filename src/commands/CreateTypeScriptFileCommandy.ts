import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { IScriptService } from "../services/script/IScriptService";
import { Uri, window } from "vscode";
import { EngineType } from "../models/EngineType";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { IScript } from "../models/IScript";

@injectable()
export class CreateTypeScriptFileCommandy implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createTypeScriptFile";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
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
                const fileUri = Uri.joinPath(scriptDirectory.directory.absoluteUri, `${fileName}.ts`);

                if(!await this.shouldFileReallyBeCreated(script, fileUri)) {
                    return;
                }

                await this.scriptRemoteService.uploadScript(script);
                await this.fileService.saveToFile(fileUri, "");
            }
        }
    }

    private async shouldFileReallyBeCreated(script: IScript, fileUri: Uri): Promise<boolean> {
        const existingScriptOnServer = this.scriptRepositoryService.getScriptFromId(script._id);
        if (existingScriptOnServer) {
            const result = await this.askUserIfFileShouldBeOverriden(script);
            if (result === "No") {
                return false;
            }
        }
        
        if (this.fileService.fileExists(fileUri)) {
            const result = await this.askUserIfFileShouldBeOverriden(script);
            if (result === "No") {
                return false;
            }
        }

        return true;
    }

    private async askUserIfFileShouldBeOverriden(script: IScript) {
        return await window.showQuickPick(["No", "Yes"], { canPickMany: false, placeHolder: `Override '${script._id}'?` });
    }
}
