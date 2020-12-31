import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { window } from "vscode";
import { IScriptService } from "../services/script/IScriptService";

@injectable()
export class StartScriptCommand implements ICommand {
    id: string = "onCommand:iobroker-javascript.startScript";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}
    
    async execute(...args: any[]) {
        const activeDocument = window.activeTextEditor?.document;

        if (activeDocument) {
            const ioBrokerId = await this.scriptService.getIoBrokerId(activeDocument.uri);

            if (ioBrokerId.length > 0) {
                this.connectionService.startScript({ 
                    _id: ioBrokerId,
                    common: {}
                });
            }
        }
    }    
}