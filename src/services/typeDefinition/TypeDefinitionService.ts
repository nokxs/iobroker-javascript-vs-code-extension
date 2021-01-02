import { ITypeDefinitionService } from "./ITypeDefinitionService";
import axios from "axios";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { Uri } from "vscode";

@injectable()
export class TypeDefinitionService implements ITypeDefinitionService {
    
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) {}

    async downloadFromGithubAndSave(): Promise<void> {
        const response = await axios.get("https://raw.githubusercontent.com/ioBroker/ioBroker.javascript/master/lib/javascript.d.ts");
        if (response.status === 200) {
            const workspace = await this.workspaceService.getWorkspaceToUse();
            const uri = Uri.joinPath(workspace.uri, ".iobroker/types/javascript.d.ts");

            this.fileService.saveToFile(uri, response.data);
        } else {
            throw new Error(`ioBroker: Couldn't download new type defintions: ${response.status}: ${response.statusText}`);
        }
    }
    
    createTsConfig(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}