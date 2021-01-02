import * as fs from 'fs';

import { ITypeDefinitionService } from "./ITypeDefinitionService";
import axios from "axios";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { Uri, workspace, WorkspaceFolder } from "vscode";

@injectable()
export class TypeDefinitionService implements ITypeDefinitionService {
    
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) {}

    async downloadFromGithubAndSave(): Promise<void> {
        const response = await axios.get("https://raw.githubusercontent.com/ioBroker/ioBroker.javascript/master/lib/javascript.d.ts");
        if (response.status === 200) {
            const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
            const uri = Uri.joinPath(workspaceFolder.uri, ".iobroker/types/javascript.d.ts");

            await this.fileService.saveToFile(uri, response.data);
        } else {
            throw new Error(`ioBroker: Couldn't download new type defintions: ${response.status}: ${response.statusText}`);
        }
    }
    
    async createConfig(): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        await this.createDummyTs(workspaceFolder);
        await this.createTsConfig(workspaceFolder);
    }

    private async createDummyTs(workspaceFolder: WorkspaceFolder): Promise<void> {
        const uri = Uri.joinPath(workspaceFolder.uri, ".iobroker/dummy.ts");
        await this.fileService.saveToFile(uri, "// this file only exits to satisfy the TS compiler");
    }

    private async createTsConfig(workspaceFolder: WorkspaceFolder): Promise<void> {
        const uri = Uri.joinPath(workspaceFolder.uri, "tsconfig.json");
        const tsConfig = await this.getTsConfig(uri);
               
        await this.fileService.saveToFile(uri, JSON.stringify(tsConfig));
    }

    private async getTsConfig(uri: Uri): Promise<MinimalTsConfig> {
        if (fs.existsSync(uri.fsPath)) {
            const tsConfigString = await workspace.fs.readFile(uri);
            const tsConfig = <MinimalTsConfig>JSON.parse(tsConfigString.toString());

            if (!tsConfig.include) {
                tsConfig.include = new Array<string>();
            }
            tsConfig.include.push(".iobroker/dummy.ts");

            if (tsConfig.compilerOptions) {
                if (!tsConfig.compilerOptions.typeRoots) {
                    tsConfig.compilerOptions.typeRoots = new Array<string>();
                }

                tsConfig.compilerOptions.typeRoots.push("./.iobroker/types");
            } else {
                tsConfig.compilerOptions = {
                    typeRoots: ["./.iobroker/types"]
                };
            }

            return tsConfig;
        }

        return {
            "include": ["**/*", ".iobroker/dummy.ts"],
            "compilerOptions": {
                "typeRoots" : ["./.iobroker/types"]
            }
        };
    }
}

export interface MinimalTsConfig {
    include?: string[]
    compilerOptions?: {
        typeRoots?: string[]
    }
}
