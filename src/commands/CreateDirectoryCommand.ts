import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { Uri, window } from "vscode";
import { IDirectoryService } from "../services/directory/IDirectoryService";
import { IConfigRepositoryService } from "../services/configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";

@injectable()
export class CreateDirectoryCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createDirectory";
    
    constructor(        
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const parentDirectory = await this.getParentDirectoryName(args);
            if (!parentDirectory) {
                return;
            }

            let directoryName = await window.showInputBox({title: "Enter directory name..."});
            if (!directoryName) {
                return;
            }
            
            const parentDirectoryId = parentDirectory === "root" ? 
                                        "script.js" : 
                                        this.getScriptDirectory(args).directory._id;
            await this.directoryService.createDirectory(`${parentDirectoryId}.${directoryName}`, directoryName);

            const parentDirectoryPath = parentDirectory === "root" ? 
                                            Uri.joinPath(this.workspaceService.workspaceToUse.uri, this.configRepositoryService.config.scriptRoot) : 
                                            this.getScriptDirectory(args).directory.absoluteUri;
            const directoryUri = Uri.joinPath(parentDirectoryPath, `${directoryName}`);
            await this.fileService.createDirectory(directoryUri);
        }
    }

    private async getParentDirectoryName(args: any[]) : Promise<string | undefined> {
        if (!args[0]) {
              return "root";  
        }

        const scriptDirectory = this.getScriptDirectory(args);
        return await window.showQuickPick([scriptDirectory.directory.common.name ?? "Current directory", "root"], {placeHolder: "Create directory as child of..."});
    }

    private getScriptDirectory(args: any[]): ScriptDirectory {
        return <ScriptDirectory>args[0] ?? args[0][0];
    }
}
