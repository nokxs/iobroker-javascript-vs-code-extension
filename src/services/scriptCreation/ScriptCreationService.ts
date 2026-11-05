import { inject, injectable } from "inversify";
import { Uri, window } from "vscode";
import { EngineType } from "../../models/EngineType";
import { IScript } from "../../models/IScript";
import TYPES from '../../Types';
import { ScriptDirectory } from "../../views/scriptExplorer/ScriptDirectory";
import { IFileService } from "../file/IFileService";
import { IScriptService } from "../script/IScriptService";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";
import { IScriptCreationService } from "./IScriptCreationService";
import { IDirectory } from "../../models/IDirectory";
import { IScriptFileService } from "../scriptFile/IScriptFileService";

@injectable()
export class ScriptCreationService implements IScriptCreationService{
    
    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.scriptFile) private scriptFileService: IScriptFileService
    ) {}

    async createFileScriptDirectory(scriptDirectory: ScriptDirectory, fileExtension: string, engineType: EngineType) {
        await this.createFileIDirectory(scriptDirectory.directory, fileExtension, engineType);
    }

    async createFileIDirectory(directory: IDirectory, fileExtension: string, engineType: EngineType) {
        let fileName = await window.showInputBox({title: "Enter file name"});
        
        if (fileName) {
            if (fileName.endsWith(fileExtension)) {
                fileName = fileName.substring(0, fileName.lastIndexOf(fileExtension));
            }

            const script = this.scriptService.getDefaultScript(`${directory._id}.${fileName}`, engineType);
            const fileUri = this.scriptFileService.getFileUri(directory, fileName, fileExtension);

            if(!await this.shouldFileReallyBeCreated(script, fileUri)) {
                return;
            }

            await this.createFileWithName(directory, fileName, fileExtension, engineType, "", true);
        }
    }

    async createFileWithName(directory: IDirectory, fileName: string, fileExtension: string, engineType: EngineType, source = "", overwrite = false): Promise<IScript> {
        const script = this.scriptService.getDefaultScript(`${directory._id}.${fileName}`, engineType);

        if (!overwrite) {
            if (this.scriptRepositoryService.getScriptFromId(script._id)) {
                throw new Error(`The script '${script._id}' does already exist on the ioBroker server.`);
            }

            if (this.scriptFileService.exists(directory, fileName, fileExtension)) {
                throw new Error(`The file '${fileName}${fileExtension}' does already exist in '${directory._id}'.`);
            }
        }

        script.common.source = source;

        await this.scriptRemoteService.uploadScript(script);
        await this.scriptFileService.write(directory, fileName, fileExtension, source);

        return script;
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
        return await window.showQuickPick(["No", "Yes"], { canPickMany: false, placeHolder: `'${script._id}' exists already. Override?` });
    }
}
