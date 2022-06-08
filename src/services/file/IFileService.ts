import { Uri } from "vscode";

export interface IFileService {
    saveToFile(uri: Uri, content: string): Promise<void>
    readFromFile(uri: Uri): Promise<string>
    fileExists(uri: Uri): boolean
    directoryExists(uri: Uri): boolean
    rename(oldFile: Uri, newFile: Uri): Promise<void>
    delete(uri: Uri): Promise<void>
    move(oldPath: Uri, newPath: Uri): Promise<void>
    createDirectory(uri: Uri): Promise<void>
    createTemporaryFile(fileName: string, content: string): Promise<Uri>
}
