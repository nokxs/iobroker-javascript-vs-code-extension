import { IScriptRepositoryService } from "./IScriptRepositoryService";
import { IScript } from "../../models/IScript";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IDirectory } from "../../models/IDirectory";
import { IDirectoryService } from "../directory/IDirectoryService";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { RootDirectory } from "../../models/RootDirectory";

@injectable()
export class ScriptRepositoryService implements IScriptRepositoryService, IScriptChangedEventListener {
    private scripts: IScript[] = [];
    private directories: IDirectory[] = [];

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
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
        this.scripts = await this.scriptRemoteService.downloadAllScripts();
    }
    

    getRootLevelScript(): IScript[] {
        return this.getScriptsIn(new RootDirectory());
    }

    getRootLevelDirectories(): IDirectory[] {
        return this.getDirectoriesIn(new RootDirectory());
    }

    getScriptsIn(directory: IDirectory): IScript[] {
        const partCountDirectory = directory._id.split(".").length;
        return this.scripts.filter(script => {
            if (script._id.startsWith(<string>directory._id)) {
                const partCountDir = script._id.split(".").length;
                return partCountDirectory + 1 === partCountDir;
            }
            return false;
        });
    }

    getDirectoriesIn(directory: IDirectory): IDirectory[] {
        const partCountDirectory = directory._id.split(".").length;
        return this.directories.filter(dir => {
            if (dir._id.startsWith(<string>directory._id)) {
                const partCountDir = dir._id.split(".").length;
                return partCountDirectory + 1 === partCountDir;
            }
            return false;
        });
    }

    onScriptChanged(): void {
        this.updateFromServer();
    }
}
