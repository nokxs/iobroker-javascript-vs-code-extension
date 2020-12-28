import { Uri, WorkspaceFolder, workspace } from "vscode";

import { IFileService } from "./IFileService";
import { Script } from "../../models/script";
import { injectable } from "inversify";

@injectable()
export class FileService implements IFileService {
    
    async saveToFile(script: Script, workspaceFolder: WorkspaceFolder): Promise<void> {
        const relativeFilePath = this.getRelativeFilePath(script);
        const uri = Uri.joinPath(workspaceFolder.uri, relativeFilePath);

        const content = Buffer.from(script.value.common.source, 'utf8');

        await workspace.fs.writeFile(uri, content);
    }
    
    async saveAllToFile(scripts: Script[], workspaceFolder: WorkspaceFolder): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script, workspaceFolder);
        }
    }

    private getRelativeFilePath(script: Script): string {
        var path = script.id.replace("script.js.", "");
        path = this.replaceAll(path, ".", "/");
        path = this.replaceAll(path, "_", " ");
        const extension = script.value.common.engineType === "Javascript/js" ? "js" : ""; // TODO support for different file formats
        return `${path}.${extension}`;
    }

    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}