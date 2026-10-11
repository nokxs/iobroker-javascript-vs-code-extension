import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { window } from "vscode";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";
import CONSTANTS from "../Constants";

@injectable()
export class ScanForChangesCommand implements ICommand {
    id: string = "iobroker-javascript.view.changed-scripts.scanForChanges";

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
    ) {}

    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }

        const message = window.setStatusBarMessage("$(sync~spin) ioBroker: Scanning all scripts for changes...");
        try {
            await this.scriptRepositoryService.evaluateScriptOnRemoteForAllScripts();
            await this.scriptRepositoryService.evaluateDirtyStateForAllScripts();
        } finally {
            message.dispose();
        }

        const changedScripts = this.scriptRepositoryService.getAllChangedScripts();
        window.setStatusBarMessage(`ioBroker: Scan finished. Found ${changedScripts.length} changed script(s)`, CONSTANTS.statusBarMessageTime);
    }
}
