import { IScriptRepositoryService } from "./IScriptRepositoryService";
import { IScript } from "../../models/IScript";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IDirectory } from "../../models/IDirectory";
import { IDirectoryService } from "../directory/IDirectoryService";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { RootDirectory } from "../../models/RootDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { Uri } from "vscode";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IScriptService } from "../script/IScriptService";
import { EngineType } from "../../models/EngineType";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { ScriptId } from "../../models/ScriptId";

@injectable()
export class ScriptRepositoryService implements IScriptRepositoryService, IScriptChangedEventListener {
    private scripts: ILocalScript[] = [];
    private directories: IDirectory[] = [];

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ){}

    async init(): Promise<void> {
        await this.updateFromServer();
        this.scriptRemoteService.registerScriptChangedEventListener(this);
    }

    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        this.scriptRemoteService.registerScriptChangedEventListener(listener);
    }

    async updateFromServer(): Promise<void> {
        this.directories = await this.directoryService.downloadAllDirectories();
        
        const ioBrokerScripts = await this.scriptRemoteService.downloadAllScripts();
        this.scripts = ioBrokerScripts.map(script => {
            return {
                _id: script._id,
                ioBrokerScript: script,
                absoluteUri: this.getAbsoluteFileUri(script, this.directories),
                relativeUri: this.getRelativeFileUri(script, this.directories)
            };
        });
    }
    
    getAllScripts(): ILocalScript[] {
        return this.scripts;
    }

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined {
        return this.scripts.find(script => script.absoluteUri === uri);
    }

    getScriptFromId(id: ScriptId): ILocalScript | undefined {
        return this.scripts.find(script => script._id === id);
    }

    getRootLevelScript(): ILocalScript[] {
        return this.getScriptsIn(new RootDirectory());
    }

    getRootLevelDirectories(): IDirectory[] {
        return this.getDirectoriesIn(new RootDirectory());
    }

    getScriptsIn(directory: IDirectory): ILocalScript[] {
        return this.filterByLength(this.scripts, directory, 1);
    }

    getDirectoriesIn(directory: IDirectory): IDirectory[] {
        return this.filterByLength(this.directories, directory, 1);
    }

    onScriptChanged(): void {
        this.updateFromServer();
    }

    private getRelativeFileUri(script: IScript, directories: IDirectory[]): Uri {
        
        let scriptRoot = this.configRepositoryService.config.scriptRoot;
        scriptRoot = scriptRoot.endsWith("/") ? scriptRoot : `${scriptRoot}/`;
        
        const engineType = <EngineType>script.common.engineType ?? EngineType.unkown;
        const extension = this.scriptService.getFileExtension(engineType);
        
        let parentDirectory: IDirectory = new RootDirectory();
        let parentPath: string[] = [];
        do {
            parentDirectory = this.getParentDirectory(script, directories);
            parentPath.push(parentDirectory.common?.name ?? "");
        } while (!(parentDirectory instanceof RootDirectory));
        
        return Uri.parse(`${scriptRoot}${parentPath.join("/")}${script.common.name}.${extension}`);
    }

    private getAbsoluteFileUri(script: IScript, directories: IDirectory[]): Uri {
        const workspaceRoot = this.workspaceService.workspaceToUse;
        const relativeFileUri = this.getRelativeFileUri(script, directories);
        
        return Uri.joinPath(workspaceRoot.uri, relativeFileUri.path);
    }

    private getParentDirectory(child: IScript | IDirectory, directories: IDirectory[]): IDirectory {
        const parents = this.filterByLength(directories, child, -1);
        if(parents.length === 0) {
            return new RootDirectory();
        } else if (parents.length === 1) {
            return parents[0];
        }

        throw Error(`Could not find parent for ${child._id}`);
    }

    private filterByLength<TSource extends ILocalScript | IDirectory>(source: TSource[], child: IScript | IDirectory, offset: number): TSource[] {
        const partCountDirectory = child._id.split(".").length;
        return source.filter(item => {
            if (item._id.startsWith(<string>child._id)) {
                const partCountDir = item._id.split(".").length;
                return partCountDirectory + offset === partCountDir;
            }
            return false;
        });
    }
}
