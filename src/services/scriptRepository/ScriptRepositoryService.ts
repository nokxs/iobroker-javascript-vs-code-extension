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
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();

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
        this.raiseScriptChangedEvent(undefined, undefined);
    }

    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        this.scriptEventListeners.push(listener);
    }

    async updateFromServer(): Promise<void> {
        const ioBrokerDirectories = await this.directoryService.downloadAllDirectories();
        this.directories = ioBrokerDirectories.map(dir => {
            return {
                _id: dir._id,
                common: dir.common,
                relativeUri: this.getRelativeDirectoryUri(dir, ioBrokerDirectories),
                absoluteUri: this.getAbsoluteDirectoryUri(dir, ioBrokerDirectories)
            };
        });
        
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
    
    getAllDirectories(): IDirectory[] {
        return this.directories;
    }

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined {
        return this.scripts.find(script => script.absoluteUri === uri);
    }

    getScriptFromId(id: ScriptId): ILocalScript | undefined {
        return this.scripts.find(script => script._id === id);
    }

    getRootLevelScript(): ILocalScript[] {
        return this.getScriptsIn(new RootDirectory(this.workspaceService));
    }

    getRootLevelDirectories(): IDirectory[] {
        return this.getDirectoriesIn(new RootDirectory(this.workspaceService));
    }

    getScriptsIn(directory: IDirectory): ILocalScript[] {
        return this.filterByLength(this.scripts, directory, 1);
    }

    getDirectoriesIn(directory: IDirectory): IDirectory[] {
        return this.filterByLength(this.directories, directory, 1);
    }

    async onScriptChanged(id: string, script: IScript): Promise<void> {
         // TODO: Currently all scripts are redownloaded every time a single script changes.
         //       Performance could be optimized, if only the changed script is updated.
        await this.updateFromServer();
        this.raiseScriptChangedEvent(id, script);
    }

    private getRelativeDirectoryUri(dir: IDirectory, ioBrokerDirectories: IDirectory[]): Uri {
        let currentDirectory: IDirectory = dir;
        let parentPath: string[] = [dir.common?.name ?? "unkown"];
        
        let scriptRoot = this.configRepositoryService.config.scriptRoot;
        scriptRoot = scriptRoot.endsWith("/") ? scriptRoot.slice(0, -1) : scriptRoot;

        do {
            currentDirectory = this.getParentDirectory(currentDirectory, ioBrokerDirectories);
            const name = currentDirectory.common?.name;
            if (name) {
                parentPath.push(name);
            }
        } while (!(currentDirectory instanceof RootDirectory));

        const directoryPath = parentPath.reverse().join("/");
        const fullDirectoryPath = `${scriptRoot}/${directoryPath}`;
        return Uri.parse(fullDirectoryPath);
    }

    private getAbsoluteDirectoryUri(dir: IDirectory, directories: IDirectory[]): Uri {
        const workspaceRoot = this.workspaceService.workspaceToUse;
        const relativeFileUri = this.getRelativeDirectoryUri(dir, directories);
        
        return Uri.joinPath(workspaceRoot.uri, relativeFileUri.path);
    }

    private getRelativeFileUri(script: IScript, directories: IDirectory[]): Uri {        
        const engineType = <EngineType>script.common.engineType ?? EngineType.unkown;
        const extension = this.scriptService.getFileExtension(engineType);
        
        let parentDirectory = this.getParentDirectory(script, directories);
                
        return Uri.parse(`${parentDirectory.relativeUri.path}/${script.common.name}.${extension}`);
    }

    private getAbsoluteFileUri(script: IScript, directories: IDirectory[]): Uri {
        const workspaceRoot = this.workspaceService.workspaceToUse;
        const relativeFileUri = this.getRelativeFileUri(script, directories);
        
        return Uri.joinPath(workspaceRoot.uri, relativeFileUri.path);
    }

    private getParentDirectory(child: IScript | IDirectory, directories: IDirectory[]): IDirectory {
        const parentId = child._id.substring(0, child._id.lastIndexOf("."));
        const parents = directories.filter(item => item._id === parentId);

        if(parents.length === 0) {
            return new RootDirectory(this.workspaceService);
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

    private raiseScriptChangedEvent(id: string | undefined, script: IScript | undefined) {
        this.scriptEventListeners.forEach(listener => listener.onScriptChanged(id, script));
    }
}
