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

    async getLocalOnlyDirectoriesIn(directory: IDirectory) : Promise<ILocalOnlyScript[]> {
        const directoriesIoBroker = this.scriptRepositoryService.getDirectoriesIn(directory);
        const supportedDirectoryNames = await this.getSupportedDirectoryNames(directory);
        const onlyLocalDirectoryNames = this.getOnlyLocalDirectories(supportedDirectoryNames, directoriesIoBroker);

        return this.convertToLocalOnlyDirectories(onlyLocalDirectoryNames, directory);
    }

    async getOnlyLocalScriptsIn(directory: IDirectory): Promise<ILocalOnlyScript[]> {
        const scriptsIoBroker = this.scriptRepositoryService.getScriptsIn(directory);      
        const supportedLocalFiles = await this.getSupportedFilesIn(directory);
        const onlyLocalScripts = this.getOnlyLocalFiles(supportedLocalFiles, scriptsIoBroker);

        return this.convertToLocalOnlyScripts(onlyLocalScripts, directory);
    }

    private async getSupportedDirectoryNames(directory: IDirectory) {
        const localDirectories = await vscode.workspace.fs.readDirectory(directory.absoluteUri);
        const localDirectoryNames = localDirectories
            .filter(content => content[1] === vscode.FileType.Directory)
            .map(content => content[0]);
        const filetedLocalDirectoryNames = localDirectoryNames.filter(name => name !== ".iobroker");
        return filetedLocalDirectoryNames;
    }

    private getOnlyLocalDirectories(supportedDirectoryNames: string[], directoriesIoBroker: IDirectory[]) {
        return supportedDirectoryNames.filter(directoryPath => !directoriesIoBroker.some(directory => path.basename(directory.absoluteUri.fsPath) === directoryPath));
    }

    private convertToLocalOnlyDirectories(onlyLocalDirectoryNames: string[], directory: IDirectory): ILocalOnlyScript[] | PromiseLike<ILocalOnlyScript[]> {
        return onlyLocalDirectoryNames.map(directoryName => {
            return {
                path: vscode.Uri.joinPath(directory.absoluteUri, directoryName)
            };
        });
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
