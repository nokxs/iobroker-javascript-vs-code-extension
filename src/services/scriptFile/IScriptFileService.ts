import { Uri } from "vscode";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";

/**
 * Encapsulates the mapping between ioBroker script ids/directories and the local files.
 * This used to live inside the commands. It is shared by the commands and the AI tools now.
 */
export interface IScriptFileService {
    getFileUri(directory: IDirectory, fileName: string, fileExtension: string): Uri
    exists(directory: IDirectory, fileName: string, fileExtension: string): boolean

    write(directory: IDirectory, fileName: string, fileExtension: string, content: string): Promise<Uri>
    writeContent(fileUri: Uri, content: string): Promise<void>

    rename(script: ILocalScript, newName: string, fileExtension: string): Promise<Uri>
    move(script: ILocalScript, targetDirectory: IDirectory): Promise<Uri>
    delete(script: ILocalScript): Promise<boolean>
}
