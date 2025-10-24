import { ITypeDefinitionService } from "./ITypeDefinitionService";
import axios from "axios";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { Uri, WorkspaceFolder } from "vscode";
import * as tar from 'tar';

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
    
    private globalTypeDefinitionFile: string = `export {};

declare global {
    function require(library: string): any;
}`;

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
            ".iobroker/types/**/*.d.ts"
        ],
        "exclude": [
            "node_modules/**"
        ]
    };

    constructor(
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.configRepository) private configRepository: IConfigRepositoryService,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,
    ) {}

    async downloadIobrokerTypeDefinitionsFromGithubAndSave(): Promise<void> {
        this.debugLogService.log("Downloading ioBroker type definitions from GitHub", "TypeDefinition");
        const response = await axios.get("https://raw.githubusercontent.com/ioBroker/ioBroker.javascript/refs/heads/master/src/lib/javascript.d.ts");
        if (response.status === 200) {
            const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
            const uri = Uri.joinPath(workspaceFolder.uri, ".iobroker/types/javascript.d.ts");

            this.debugLogService.log(`Saving ioBroker type definitions to ${uri.fsPath}`, "TypeDefinition");
            await this.fileService.saveToFile(uri, response.data);
            this.debugLogService.log("Successfully downloaded and saved ioBroker type definitions", "TypeDefinition");
        } else {
            const error = `ioBroker: Couldn't download new type defintions: ${response.status}: ${response.statusText}`;
            this.debugLogService.logError(error, "TypeDefinition");
            throw new Error(error);
        }
    }
    
    async downloadNodeTypeDefinitionsFromNpmAndSave(): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        const config = await this.configRepository.read(workspaceFolder);
        const version = config.iobrokerNodeTypesVersion || "20.14.10"; // Default to a stable version if not set

        this.debugLogService.log(`Downloading @types/node version ${version} from npm`, "TypeDefinition");
        const response = await axios.get(`https://registry.npmjs.org/@types/node/-/node-${version}.tgz`, { responseType: 'arraybuffer' });
        if (response.status === 200) {
            const tempUri = Uri.joinPath(workspaceFolder.uri, ".iobroker/types/temp.tgz");
            const extractPath = Uri.joinPath(workspaceFolder.uri, ".iobroker/types/node").fsPath;
            const extractUri = Uri.file(extractPath);

            this.debugLogService.log(`Saving temporary file to ${tempUri.fsPath}`, "TypeDefinition");
            await this.fileService.saveToFile(tempUri, Buffer.from(response.data));

            if (this.fileService.directoryExists(extractUri)) { 
                this.debugLogService.log(`Cleaning up existing node types directory at ${extractPath}`, "TypeDefinition");
                await this.fileService.deleteDirectory(extractUri);
            }

            this.debugLogService.log(`Creating node types directory at ${extractPath}`, "TypeDefinition");
            await this.fileService.createDirectory(extractUri);
            
            this.debugLogService.log("Extracting node types package...", "TypeDefinition");
            // Extract the contents
            await tar.x({
                file: tempUri.fsPath,
                cwd: extractPath,
                strip: 1 // Remove the first directory level (package)
            });

            // Delete temporary .tgz file
            this.debugLogService.log("Cleaning up temporary files", "TypeDefinition");
            await this.fileService.delete(tempUri);
            
            this.debugLogService.log("Successfully downloaded and installed node type definitions", "TypeDefinition");
        }
    }
    
    async createConfig(): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        await this.createTsConfig(workspaceFolder);
    }

    async createGlobalTypeDefinitions(): Promise<void> {
        const workspaceFolder = await this.workspaceService.getWorkspaceToUse();
        await this.createGlobalTypeDefinitionFile(workspaceFolder);
    }

    private async createTsConfig(workspaceFolder: WorkspaceFolder): Promise<void> {
        const uri = Uri.joinPath(workspaceFolder.uri, "tsconfig.json");
        const tsConfig = await this.getTsConfig(uri);
               
        await this.fileService.saveToFile(uri, JSON.stringify(tsConfig, null, 2));
    }

    private async createGlobalTypeDefinitionFile(workspaceFolder: WorkspaceFolder): Promise<void> {
        const uri = Uri.joinPath(workspaceFolder.uri, ".iobroker/types/global.d.ts");
        await this.fileService.saveToFile(uri, this.globalTypeDefinitionFile);
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
