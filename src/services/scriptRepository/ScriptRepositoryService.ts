import { IScriptRepositoryService } from "./IScriptRepositoryService";
import { IScript } from "../../models/IScript";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IDirectory } from "../../models/IDirectory";
import { IDirectoryService } from "../directory/IDirectoryService";

@injectable()
export class ScriptRepositoryService implements IScriptRepositoryService {
    private scripts: IScript[] = [];
    private directories: IDirectory[] = [];

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.scriptRemote) private directoryService: IDirectoryService,
    ){}

    async updateFromServer(): Promise<void> {
        this.scripts = await this.scriptRemoteService.downloadAllScripts();
        this.directories = await this.directoryService.downloadAllDirectories();
    }
    
    getScriptsIn(directory: IDirectory): IScript[] {
        return this.scripts.filter(script => script._id.startsWith(<string>directory._id));
    }

    getDirectories(directory: IDirectory): IDirectory[] {
        const partCountDirectory = directory._id.split(".").length;
        return this.directories.filter(dir => {
            if (dir._id.startsWith(<string>directory._id)) {
                const partCountDir = dir._id.split(".").length;
                return partCountDirectory + 1 === partCountDir;
            }
            return false;
        });
    }
}
