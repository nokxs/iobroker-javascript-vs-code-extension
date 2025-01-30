import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { Uri, window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScript } from "../models/IScript";
import CONSTANTS from "../Constants";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";
import { IScriptRemoteService } from '../services/scriptRemote/IScriptRemoteService';
import { IIobrokerConnectionService } from '../services/iobrokerConnection/IIobrokerConnectionService';
import { OnlyLocalScriptItem } from "../views/scriptExplorer/OnlyLocalScriptItem";
import { IFileService } from "../services/file/IFileService";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";


@injectable()
export class UploadCommandProxy implements ICommand {
    id = "iobroker-javascript.view.scriptExplorer.uploadScript";
    
    private uploadCommand: UploadCommand;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {
        this.uploadCommand = new UploadCommand(iobrokerConnectionService, scriptRemoteService, scriptService, scriptIdService, scriptRepositoryService, fileService);
    }

    execute(...args: any[]) {
        this.uploadCommand.execute(...args);
    }
}

@injectable()
export class UploadCommand implements ICommand {
    public static get id(): string {
        return "iobroker-javascript.upload";
    }

    id: string = UploadCommand.id;
    
    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}

    async execute(...args: any[]) {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }

        const script = await this.getScriptData(args);

        if (script) {
            await this.scriptRemoteService.uploadScript(script);
            window.setStatusBarMessage(`ioBroker: Finished uploading script`, CONSTANTS.statusBarMessageTime);
        } else {
            window.setStatusBarMessage(`ioBroker: Couldn't upload script`, CONSTANTS.statusBarMessageTime);
        }
    }

    private async getScriptData(...args: any[]): Promise<IScript | null> {
        if (args && args[0] && args[0].length > 0) {
            return this.handleScriptFromScriptExplorer(args);
        } else if (window.activeTextEditor) {
            return this.handleScriptFromEditor();
        }

        return null;
    }

    private async handleScriptFromScriptExplorer(...args: any[]): Promise<IScript | null> {
        const localScript = (<ScriptItem>args[0])?.script ?? (<ScriptItem>args[0][0])?.script ?? (<ScriptItem>args[0][0][0]).script;

        if (!localScript) {
            const scriptUri = (<OnlyLocalScriptItem>args[0])?.fileUri ?? (<OnlyLocalScriptItem>args[0][0])?.fileUri ?? (<OnlyLocalScriptItem>args[0][0][0]).fileUri;
            const defaultScript = this.createDefaultScript(scriptUri);
            defaultScript.common.source = await this.fileService.readFromFile(scriptUri);
            return defaultScript;
        }

        return this.scriptRepositoryService.getScriptWithLocalContent(localScript);
    }

    private async handleScriptFromEditor(): Promise<IScript | null> {
        if (window.activeTextEditor) {
            const scriptText = window.activeTextEditor.document.getText();
            const fileUri = window.activeTextEditor.document.uri;
            let script = await this.scriptRemoteService.downloadScriptWithUri(fileUri);
    
            if (script) {
                script.common.source = scriptText;
            } else {
                script = this.createDefaultScript(fileUri);
            }
            
            return script;
        }

        return null;
    }

    private createDefaultScript(fileUri: Uri): IScript {
        return this.scriptService.getDefaultScript(this.scriptIdService.getIoBrokerId(fileUri), this.scriptService.getEngineType(fileUri));
    }
}
