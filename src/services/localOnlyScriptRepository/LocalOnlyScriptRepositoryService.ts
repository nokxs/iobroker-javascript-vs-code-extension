import * as vscode from 'vscode';

import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScriptRepositoryService } from "./ILocalOnlyScriptRepositoryService";
import { injectable } from "inversify";

@injectable()
export class LocalOnlyScriptRepositoryService implements ILocalOnlyScriptRepositoryService {
    async getOnlyLocalScriptsInDirectory(directory: IDirectory): Promise<string[]> {
        // TODO: 
        //   - get scripts from script repository service
        //   - filter for valid file extensions
        //   - ensure local only files can be uploaded
        //   - ensure uploaded scripts are converted to normal script items
        //   - add posibility to delete all scripts, which are only local

        return (await vscode.workspace.fs.readDirectory(directory.absoluteUri))
                .filter(content => content[1] === vscode.FileType.File)
                .filter(file => !scripts.some(script => path.basename(script.absoluteUri.fsPath) === file[0]))
                .map(file => file[0]);
    }
    
}
