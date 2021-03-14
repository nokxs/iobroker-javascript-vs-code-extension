import * as path from 'path';
import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IScriptRepositoryService } from "../services/scriptRepository/IScriptRepositoryService";
import { QuickPickItem, Uri, window } from "vscode";
import { ScriptItem } from "../views/scriptExplorer/ScriptItem";
import { IScriptRemoteService } from "../services/scriptRemote/IScriptRemoteService";
import { IFileService } from "../services/file/IFileService";
import { IDirectory } from "../models/IDirectory";

interface DirectoryQuickPickItem extends QuickPickItem {
    directory: IDirectory
}

@injectable()
export class MoveCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.move";

    constructor(        
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}
    
    async execute(...args: any[]) {
        const availableDirectories = this.scriptRepositoryService.getAllDirectories();
        const availableDirectoryIds: DirectoryQuickPickItem[] = availableDirectories.map(dir => <DirectoryQuickPickItem>{
            label: dir._id.replace("script.js.", ""),
            directory: dir
        });
        const pickedDirectory = await window.showQuickPick(availableDirectoryIds, { canPickMany: false});

        if (pickedDirectory) {
            const scriptItem = <ScriptItem>args[0] ?? <ScriptItem>args[0][0];
            await this.scriptRemoteService.move(scriptItem.script._id, pickedDirectory.directory);

            if (this.fileService.fileExists(scriptItem.script.absoluteUri)) {
                const fileName = path.basename(scriptItem.script.absoluteUri.fsPath);
                const newPath = Uri.joinPath(pickedDirectory.directory.absoluteUri, fileName);

                if (!this.fileService.fileExists(pickedDirectory.directory.absoluteUri)) {
                    this.fileService.createDirectory(pickedDirectory.directory.absoluteUri);
                }
                
                await this.fileService.move(scriptItem.script.absoluteUri, newPath);
            }
        }
    }
}
