import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from '../services/scriptRemote/IScriptRemoteService';
import { IIobrokerConnectionService } from '../services/iobrokerConnection/IIobrokerConnectionService';
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { window } from "vscode";
import { ILocalScript } from "../models/ILocalScript";
import CONSTANTS from "../Constants";

@injectable()
export class UploadAllCommand implements ICommand {
    id: string = "iobroker-javascript.uploadAll";
    
    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService
    ) {}

    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }

        var changedScripts = this.scriptRepositoryService.getAllChangedScripts();
        var unsuccessfulUploads: Array<ILocalScript> = [];
        for (const changedScript of changedScripts) {
            const script = await this.scriptRepositoryService.getScriptWithLocalContent(changedScript);

            if (script) {
                await this.scriptRemoteService.uploadScript(script);                
            }
            else {
                unsuccessfulUploads.push(changedScript);
            }
        }

        if (unsuccessfulUploads.length === 0) {
            window.setStatusBarMessage(`ioBroker: Finished uploading all ${changedScripts.length} scripts`, CONSTANTS.StatusBarMessageTime);
        }
        else {
            window.showErrorMessage(`ioBroker: Upload of script(s) ${unsuccessfulUploads.map(s => `'${s.ioBrokerScript.common.name}', `)} was not successful`);
        }
    }
}
