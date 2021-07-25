import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IFileService } from "../services/file/IFileService";
import { ScriptDirectory } from "../views/scriptExplorer/ScriptDirectory";
import { Uri, window } from "vscode";
import { IDirectoryService } from "../services/directory/IDirectoryService";

@injectable()
export class CreateDirectoryCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createDirectory";

    
    constructor(        
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}
    
    async execute(...args: any[]) {
        if (args) {
            const scriptDirectory = <ScriptDirectory>args[0] ?? <ScriptDirectory>args[0][0];
            let directoryName = await window.showInputBox({title: "Enter directory name"});
            
            if (directoryName) {

                this.directoryService.createDirectory(`${scriptDirectory.directory._id}.${directoryName}`, directoryName);

                const directoryUri = Uri.joinPath(scriptDirectory.directory.absoluteUri, `${directoryName}`);
                await this.fileService.createDirectory(directoryUri);
            }
        }
    }
}
