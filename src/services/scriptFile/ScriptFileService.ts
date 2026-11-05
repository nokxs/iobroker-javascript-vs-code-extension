import * as path from "path";
import { Uri } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IFileService } from "../file/IFileService";
import { IScriptFileService } from "./IScriptFileService";

@injectable()
export class ScriptFileService implements IScriptFileService {
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}

    getFileUri(directory: IDirectory, fileName: string, fileExtension: string): Uri {
        return Uri.joinPath(directory.absoluteUri, `${fileName}${fileExtension}`);
    }

    exists(directory: IDirectory, fileName: string, fileExtension: string): boolean {
        return this.fileService.fileExists(this.getFileUri(directory, fileName, fileExtension));
    }

    async write(directory: IDirectory, fileName: string, fileExtension: string, content: string): Promise<Uri> {
        const fileUri = this.getFileUri(directory, fileName, fileExtension);
        await this.fileService.saveToFile(fileUri, content);
        return fileUri;
    }

    async writeContent(fileUri: Uri, content: string): Promise<void> {
        await this.fileService.saveToFile(fileUri, content);
    }

    async rename(script: ILocalScript, newName: string, fileExtension: string): Promise<Uri> {
        const newFileUri = Uri.joinPath(Uri.file(path.dirname(script.absoluteUri.fsPath)), `${newName}.${fileExtension}`);
        await this.fileService.rename(script.absoluteUri, newFileUri);
        return newFileUri;
    }

    async move(script: ILocalScript, targetDirectory: IDirectory): Promise<Uri> {
        if (!this.fileService.directoryExists(targetDirectory.absoluteUri)) {
            await this.fileService.createDirectory(targetDirectory.absoluteUri);
        }

        const fileName = path.basename(script.absoluteUri.fsPath);
        const newFileUri = Uri.joinPath(targetDirectory.absoluteUri, fileName);
        await this.fileService.move(script.absoluteUri, newFileUri);
        return newFileUri;
    }

    async delete(script: ILocalScript): Promise<boolean> {
        if (!this.fileService.fileExists(script.absoluteUri)) {
            return false;
        }

        await this.fileService.delete(script.absoluteUri);
        return true;
    }
}
