import { Uri, WorkspaceFolder, workspace } from "vscode";

import { IFileService } from "./IFileService";
import { ScriptObject } from "../../models/Script";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IScriptService } from "../script/IScriptService";

@injectable()
export class FileService implements IFileService {
    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
    ) {}

    async saveToFile(script: ScriptObject, workspaceFolder: WorkspaceFolder): Promise<void> {
        const relativeFilePath = this.scriptService.getRelativeFilePath(script);
        const uri = Uri.joinPath(workspaceFolder.uri, relativeFilePath);

        const content = Buffer.from(script.value.common.source ?? "", 'utf8');

        await workspace.fs.writeFile(uri, content);
    }
    
    async saveAllToFile(scripts: ScriptObject[], workspaceFolder: WorkspaceFolder): Promise<void> {
        for (const script of scripts) {
            await this.saveToFile(script, workspaceFolder);
        }
    }
}
