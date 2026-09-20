import { window } from "vscode";

import { ICommand } from "./ICommand";

import { inject, injectable } from "inversify";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import TYPES from "../Types";
import { IJsInstanceService } from "../services/jsInstanceService/IJsInstanceService";
import Constants from "../Constants";

@injectable()
export class ChangeJsInstanceCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.changeJsInstance";
    
    constructor(
        @inject(TYPES.services.jsInstance) private jsInstanceService: IJsInstanceService
    ) {}

    async execute(...args: any[]) {
        if (args && args[0]) {
            const script = (<ScriptItem>args[0]).script;
            
            const instances = await this.jsInstanceService.getAvailableInstances();

            const instanceToUse = await window.showQuickPick(instances.map(instance => instance._id), {placeHolder: "Select the JS Instance to use"});
            if (instanceToUse) {
                await this.jsInstanceService.changeInstance(script._id, {_id: instanceToUse});
                await window.setStatusBarMessage(`The js instance was successfuly set to '${instanceToUse}'`, Constants.statusBarMessageTime);
            }            
        } else {
            window.showInformationMessage("This command can only be invoked over the script explorer!");
        }
    }
}
