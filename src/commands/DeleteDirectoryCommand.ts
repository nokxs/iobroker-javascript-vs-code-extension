import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { window } from "vscode";
import CONSTANTS from "../Constants";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { IDirectory } from "../models/IDirectory";

@injectable()
export class DeleteDirectoryCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.deleteDirectory";

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];

            if (scriptDirectory.directory._id === CONSTANTS.skriptIds.global || scriptDirectory.directory._id === CONSTANTS.skriptIds.common) {
                await window.showErrorMessage("Cannot delete global or common directory, because they are needed by iobroker.");
                return;
            }

            const pickResult = await window.showQuickPick(["No", "Yes"], {canPickMany: false, placeHolder: `Delete directory '${scriptDirectory.directory.common?.name}' and ALL scripts/directories in this directory?`});

            if (pickResult === "Yes") {
                await this.deleteRecursively(scriptDirectory.directory);
                
                if (this.fileService.directoryExists(scriptDirectory.directory.absoluteUri)) {
                    await this.fileService.deleteDirectory(scriptDirectory.directory.absoluteUri);
                }

                window.setStatusBarMessage(`Successfully deleted '${scriptDirectory.directory.common.name}'`, CONSTANTS.statusBarMessageTime);
            }
        }
    }

    async deleteRecursively(directory: IDirectory): Promise<void> {
        for (const dir of this.scriptRepositoryService.getDirectoriesIn(directory)) {
            await this.deleteRecursively(dir);
        }

        for (const script of this.scriptRepositoryService.getScriptsIn(directory)) {
            await this.scriptRemoteService.delete(script._id);            
        }

        await this.scriptRemoteService.delete(directory._id);
    }
}
