import { Uri, WorkspaceFolder } from "vscode";

export interface IFileService {
    saveToFile(uri: Uri, content: string): Promise<void>
}