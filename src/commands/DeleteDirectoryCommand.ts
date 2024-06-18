import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { window } from "vscode";
import CONSTANTS from "../Constants";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";

@injectable()
export class DeleteDirectoryCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.deleteDirectory";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];
            const pickResult = await window.showQuickPick(["No", "Yes"], {canPickMany: false, placeHolder: `Delete directory '${scriptDirectory.directory.common?.name}' and ALL scripts/directories in this directory?`});

            if (pickResult === "Yes") {
                await this.scriptRemoteService.delete(scriptDirectory.directory._id);
                
                if (this.fileService.directoryExists(scriptDirectory.directory.absoluteUri)) {
                    this.fileService.deleteDirectory(scriptDirectory.directory.absoluteUri);
                }

                window.setStatusBarMessage(`Successfully deleted '${scriptDirectory.directory.common.name}'`, CONSTANTS.StatusBarMessageTime);
            }
        }
    }
}
