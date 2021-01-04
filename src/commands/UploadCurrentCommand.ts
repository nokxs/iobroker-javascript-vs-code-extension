import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import { IConfigService } from "../services/config/IConfigService";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IFileService } from "../services/file/IFileService";
import TYPES from "../Types";
import { window } from "vscode";

@injectable()
export class UploadCurrentCommand implements ICommand {
    id: string = "iobroker-javascript.upload";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.config) private configService: IConfigService
    ) {}

    async execute(...args: any[]) {
        if (window.activeTextEditor) {
            const scriptText = window.activeTextEditor.document.getText();
            const fileUri = window.activeTextEditor.document.uri;

            const script = await this.connectionService.downloadScriptWithUri(fileUri);
            
            if (script) {
                script.common.source = scriptText;
                await this.connectionService.uploadScript(script);
            } else {
                // TODO: Script does not exist. What to do?
            }
        }
    }
}
