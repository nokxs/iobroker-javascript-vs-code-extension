import * as vscode from 'vscode';
import * as path from 'path';

import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScriptRepositoryService } from "./ILocalOnlyScriptRepositoryService";
import { inject, injectable } from "inversify";
import { IScriptRepositoryService } from '../scriptRepository/IScriptRepositoryService';
import TYPES from '../../Types';
import { ILocalOnlyScript } from '../../models/ILocalOnlyScript';

@injectable()
export class LocalOnlyScriptRepositoryService implements ILocalOnlyScriptRepositoryService {
    
    constructor(
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
    ) {}

    async getOnlyLocalScriptsInDirectory(directory: IDirectory): Promise<ILocalOnlyScript[]> {
        // TODO: 
        //   - ensure local only files can be uploaded
        //   - ensure uploaded scripts are converted to normal script items
        //   - add posibility to delete all scripts, which are only local

        const scriptsIoBroker = this.scriptRepositoryService.getScriptsIn(directory);      
        
        const filesInDirectory = await vscode.workspace.fs.readDirectory(directory.absoluteUri);
        const filePathsLocal = filesInDirectory
                                    .filter(content => content[1] === vscode.FileType.File)
                                    .map(content => content[0]);  

        const knownFiles = filePathsLocal.filter(p => {
            switch (path.extname(p)) {
                case ".js":
                case ".ts":
                case ".rules":
                case ".block":
                    return true;
                default:
                    return false;
            }
        });

        const onlyLocalScripts = knownFiles.filter(filePath => !scriptsIoBroker.some(script => path.basename(script.absoluteUri.fsPath) === filePath));

        return onlyLocalScripts.map(fileName => { 
            return { 
                path: vscode.Uri.joinPath(directory.absoluteUri, fileName)
            }; 
        });
    }
    
}
