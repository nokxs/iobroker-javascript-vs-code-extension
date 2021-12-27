import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptService } from "../services/script/IScriptService";
import { IScriptIdService } from "../services/scriptId/IScriptIdService";
import { IScriptRemoteService } from '../services/scriptRemote/IScriptRemoteService';
import { IIobrokerConnectionService } from '../services/iobrokerConnection/IIobrokerConnectionService';
import { IFileService } from "../services/file/IFileService";

@injectable()
export class UploadAllCommand implements ICommand {
    id: string = "iobroker-javascript.uploadAll";
    
    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}

    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }

        return;

        // const script = await this.getScriptData(args);

        // if (script) {
        //     await this.scriptRemoteService.uploadScript(script);
        //     window.setStatusBarMessage(`ioBroker: Finished uploading script`, CONSTANTS.StatusBarMessageTime);
        // } else {
        //     window.setStatusBarMessage(`ioBroker: Couldn't upload script`, CONSTANTS.StatusBarMessageTime);
        // }
    }
}
