import { ITypeDefinitionService } from "./ITypeDefinitionService";
import axios from "axios";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { Uri, WorkspaceFolder } from "vscode";

interface CompilerOptions {
    noEmit: boolean;
    allowJs: boolean;
    checkJs: boolean;
    module: string;
    moduleResolution: string;
    esModuleInterop: boolean;
    resolveJsonModule: boolean;
    strict: boolean;
    noImplicitAny: boolean;
    target: string;
    typeRoots: string[];
}

interface MinimalTsConfig {
    compileOnSave: boolean;
    compilerOptions: CompilerOptions;
    include: string[];
    exclude: string[];
}

@injectable()
export class TypeDefinitionService implements ITypeDefinitionService {
    
    // https://github.com/ioBroker/create-adapter/blob/master/test/baselines/adapter_JS_ESLint_TypeChecking_Spaces_SingleQuotes_Apache-2.0/tsconfig.json
    private tsconfig: MinimalTsConfig = {
        "compileOnSave": true,
        "compilerOptions": {
            "noEmit": true,
            "allowJs": true,
            "checkJs": true,
            "module": "commonjs",
            "moduleResolution": "node",
            "esModuleInterop": true,
            "resolveJsonModule": true,
            "strict": true,
            "noImplicitAny": false,
            "target": "es2018",
            "typeRoots": [
                ".iobroker/types",
                "node_modules/@types"
            ]
        },
        "include": [
            "**/*.js",
            "**/*.ts",
            ".iobroker/types/javascript.d.ts"
        ],
        "exclude": [
            "node_modules/**"
        ]
    };

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
        await this.createTsConfig(workspaceFolder);
    }

    private async createTsConfig(workspaceFolder: WorkspaceFolder): Promise<void> {
        const uri = Uri.joinPath(workspaceFolder.uri, "tsconfig.json");
        const tsConfig = await this.getTsConfig(uri);
               
        await this.fileService.saveToFile(uri, JSON.stringify(tsConfig, null, 2));
    }

    private async getTsConfig(uri: Uri): Promise<MinimalTsConfig> {
        const result: any = JSON.parse(JSON.stringify(this.tsconfig)); // hack to deep copy the object

        if (this.fileService.fileExists(uri)) {
            const tsConfigString = await this.fileService.readFromFile(uri);
            const existingTsConfig = <MinimalTsConfig>JSON.parse(tsConfigString.toString());

            Object.keys(existingTsConfig).forEach(key => result[key] = (<any>existingTsConfig)[key]);
            Object.keys(this.tsconfig).forEach(key => result[key] = (<any>this.tsconfig)[key]);
        }

        return result;
    }
}
