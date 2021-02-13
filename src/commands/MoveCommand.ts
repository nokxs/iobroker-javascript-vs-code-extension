import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { window } from "vscode";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";

@injectable()
export class MoveCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.move";

    constructor(        
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService
    ) {}
    
    async execute(...args: any[]) {
        const availableDirectories = this.scriptRepositoryService.getAllDirectories();
        const availableDirectoryIds = availableDirectories.map(dir => <string>dir._id.replace("script.js.", ""));
        const pickedDirectoryId = await window.showQuickPick(availableDirectoryIds, { canPickMany: false});

        if (pickedDirectoryId) {
            const script = <ScriptItem>args[0] ?? <ScriptItem>args[0][0];
            await this.scriptRemoteService.move(script.script._id, pickedDirectoryId);
        }
    }
}
