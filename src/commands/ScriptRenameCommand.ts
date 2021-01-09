import { window } from "vscode";

import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";

@injectable()
export class ScriptRenameCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.rename";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
    ) {}

    async execute(...args: any[]) {
        if (args && args[0]) {
            const scriptName = (<ScriptItem>args[0]).script.common.name;
            const scriptId = (<ScriptItem>args[0]).script._id;

            const newScriptName = await window.showInputBox({prompt: "The new name of the script.", value: scriptName});

            if (newScriptName) {
                await this.connectionService.rename(scriptId, newScriptName);
                // TODO: Change file name
            }
        } else {
            window.showInformationMessage("This command can only be invoked over the script explorer!");
        }
    }
}
