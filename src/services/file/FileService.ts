import * as fs from 'fs';

import { Uri, workspace } from "vscode";

import { IFileService } from "./IFileService";
import { injectable } from "inversify";

@injectable()
export class FileService implements IFileService {
    async saveToFile(uri: Uri, content: string): Promise<void> {
        const contentBuffer = Buffer.from(content, 'utf8');
        await workspace.fs.writeFile(uri, contentBuffer);
    }

    async readFromFile(uri: Uri): Promise<string> {
        return (await workspace.fs.readFile(uri)).toString();
    }

    fileExists(uri: Uri): boolean {
        return fs.existsSync(uri.fsPath);
    }

    rename(oldFile: Uri, newFile: Uri): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.rename(oldFile.fsPath, newFile.fsPath, (err) => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    delete(uri: Uri): Promise<void> {
        return new Promise((resolve) => {
            fs.unlink(uri.fsPath, () => {
                resolve();
            });
        });
    }

    move(oldPath: Uri, newPath: Uri): Promise<void> {
        return this.rename(oldPath, newPath);
    }

    createDirectory(uri: Uri): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.mkdir(uri.fsPath, (err) => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
