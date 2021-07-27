import * as vscode from 'vscode';
import * as path from 'path';

import { IDirectory } from "../../models/IDirectory";
import { ILocalOnlyScriptRepositoryService } from "./ILocalOnlyScriptRepositoryService";
import { inject, injectable } from "inversify";
import { IScriptRepositoryService } from '../scriptRepository/IScriptRepositoryService';
import TYPES from '../../Types';
import { ILocalOnlyScript } from '../../models/ILocalOnlyScript';
import { ILocalScript } from '../../models/ILocalScript';
import { IFileService } from '../file/IFileService';

@injectable()
export class LocalOnlyScriptRepositoryService implements ILocalOnlyScriptRepositoryService {
    
    constructor(
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}

    async getLocalOnlyDirectoriesIn(directory: IDirectory) : Promise<ILocalOnlyScript[]> {
        const directoriesIoBroker = this.scriptRepositoryService.getDirectoriesIn(directory);
        const supportedDirectoryNames = await this.getSupportedDirectoryNamesInternal(directory.absoluteUri);
        const onlyLocalDirectoryNames = this.getOnlyLocalDirectories(supportedDirectoryNames, directoriesIoBroker);

        return this.convertToLocalOnlyDirectories(onlyLocalDirectoryNames, directory.absoluteUri);
    }

    async getOnlyLocalScriptsIn(directory: IDirectory): Promise<ILocalOnlyScript[]> {
        const scriptsIoBroker = this.scriptRepositoryService.getScriptsIn(directory);
        const supportedLocalFiles = await this.getSupportedFilesInternal(directory.absoluteUri);
        const onlyLocalScripts = this.getOnlyLocalFiles(supportedLocalFiles, scriptsIoBroker);

        return this.convertToLocalOnlyScripts(onlyLocalScripts, directory.absoluteUri);
    }

    async getSupportedLocalDirectories(directoryUri: vscode.Uri): Promise<ILocalOnlyScript[]> {
        const supportedDirectoryNames = await this.getSupportedDirectoryNamesInternal(directoryUri);
        return this.convertToLocalOnlyDirectories(supportedDirectoryNames, directoryUri);
    }

    async getSupportedLocalOnlyFiles(directoryUri: vscode.Uri): Promise<ILocalOnlyScript[]> {
        const supportedDirectoryNames = await this.getSupportedFilesInternal(directoryUri);
        return this.convertToLocalOnlyScripts(supportedDirectoryNames, directoryUri);
    }

    private async getSupportedDirectoryNamesInternal(directoryUri: vscode.Uri): Promise<string[]> {
        if (this.fileService.fileExists(directoryUri)) {
            const localDirectories = await vscode.workspace.fs.readDirectory(directoryUri);
            const localDirectoryNames = localDirectories
                .filter(content => content[1] === vscode.FileType.Directory)
                .map(content => content[0]);
            const filetedLocalDirectoryNames = localDirectoryNames.filter(name => name !== ".iobroker");
            return filetedLocalDirectoryNames;
        }

        return [];
    }

    private async getSupportedFilesInternal(directoryUri: vscode.Uri): Promise<string[]> {
        if (this.fileService.fileExists(directoryUri)) {
            const filesInDirectory = await vscode.workspace.fs.readDirectory(directoryUri);
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

        return [];
    }

    private getOnlyLocalDirectories(supportedDirectoryNames: string[], directoriesIoBroker: IDirectory[]) {
        return supportedDirectoryNames.filter(directoryPath => !directoriesIoBroker.some(directory => path.basename(directory.absoluteUri.fsPath) === directoryPath));
    }

    private convertToLocalOnlyDirectories(onlyLocalDirectoryNames: string[], directoryUri: vscode.Uri): ILocalOnlyScript[] {
        return onlyLocalDirectoryNames.map(directoryName => {
            return {
                path: vscode.Uri.joinPath(directoryUri, directoryName)
            };
        });
    }
    
    private convertToLocalOnlyScripts(onlyLocalScripts: string[], uri: vscode.Uri): ILocalOnlyScript[] {
        return onlyLocalScripts.map(fileName => {
            return {
                path: vscode.Uri.joinPath(uri, fileName)
            };
        });
    }

    private getOnlyLocalFiles(supportedFiles: string[], scriptsIoBroker: ILocalScript[]) {
        return supportedFiles.filter(filePath => !scriptsIoBroker.some(script => path.basename(script.absoluteUri.fsPath) === filePath));
    }
}
