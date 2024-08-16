import { injectable, inject } from "inversify";
import { TextDocument, Uri, window, workspace } from "vscode";
import CONSTANTS from "../../Constants";
import { IScript } from "../../models/IScript";
import TYPES from "../../Types";
import { IScriptService } from "../script/IScriptService";
import { IScriptIdService } from "../scriptId/IScriptIdService";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IAutoUploadService } from "./IAutoUploadService";

@injectable()
export class AutoUploadService implements IAutoUploadService {

    constructor(
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService
    ) { }

    async init(): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        workspace.onDidSaveTextDocument(async (document: TextDocument) => {
            if (!document.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
                return;
            }
            
            const scriptText = document.getText();
            const fileUri = document.uri;
            let script = await this.scriptRemoteService.downloadScriptWithUri(fileUri);
    
            if (script) {
                script.common.source = scriptText;
            } else {
                script = this.createDefaultScript(fileUri);
            }       
            
            if (script) {
                await this.scriptRemoteService.uploadScript(script);
                window.setStatusBarMessage(`ioBroker: Auto uploaded script ${document.fileName}`, CONSTANTS.statusBarMessageTime);
            }
        });
    }

    private createDefaultScript(fileUri: Uri): IScript {
        return this.scriptService.getDefaultScript(
            this.scriptIdService.getIoBrokerId(fileUri), 
            this.scriptService.getEngineType(fileUri));
    }
}
