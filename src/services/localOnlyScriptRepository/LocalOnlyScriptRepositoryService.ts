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
        const scriptsIoBroker = this.scriptRepositoryService.getScriptsIn(directory);      
        const supportedFiles = await this.getSupportedFilesIn(directory);
        const onlyLocalScripts = this.getOnlyLocalFiles(supportedFiles, scriptsIoBroker);

        return this.convertToLocalOnlyScripts(onlyLocalScripts, directory);
    }
    

    private convertToLocalOnlyScripts(onlyLocalScripts: string[], directory: IDirectory): ILocalOnlyScript[] | PromiseLike<ILocalOnlyScript[]> {
        return onlyLocalScripts.map(fileName => {
            return {
                path: vscode.Uri.joinPath(directory.absoluteUri, fileName)
            };
        });
    }

    private getOnlyLocalFiles(supportedFiles: string[], scriptsIoBroker: import("e:/Git/iobroker-javascript-vs-code-extension/src/models/ILocalScript").ILocalScript[]) {
        return supportedFiles.filter(filePath => !scriptsIoBroker.some(script => path.basename(script.absoluteUri.fsPath) === filePath));
    }

    private async getSupportedFilesIn(directory: IDirectory) {
        const filesInDirectory = await vscode.workspace.fs.readDirectory(directory.absoluteUri);
        const filePathsLocal = filesInDirectory
            .filter(content => content[1] === vscode.FileType.File)
            .map(content => content[0]);

        const supportedFiles = filePathsLocal.filter(p => {
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
        return supportedFiles;
    }
}
