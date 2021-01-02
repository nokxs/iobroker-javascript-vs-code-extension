import { Uri, workspace } from "vscode";
import { inject, injectable } from "inversify";

import { IFileService } from "./IFileService";

@injectable()
export class FileService implements IFileService {
      async saveToFile(uri: Uri, content: string): Promise<void> {
        const contentBuffer = Buffer.from(content, 'utf8');
        await workspace.fs.writeFile(uri, contentBuffer);
    }
}
