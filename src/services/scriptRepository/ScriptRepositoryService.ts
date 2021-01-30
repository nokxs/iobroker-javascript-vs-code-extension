import { Directory } from "../../models/Directory";
import { IScriptRepositoryService } from "./IScriptRepositoryService";
import { Script } from "../../models/Script";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IConnectionService } from "../connection/IConnectionService";
import { ScriptObject } from "../../models/ScriptObject";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";

@injectable()
export class ScriptRepositoryService implements IScriptRepositoryService {
    private directoriesFlat: Directory[] = [];

    constructor(        
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
    ){}

    async updateFromServer(): Promise<void> {
        const allScripts = await this.scriptRemoteService.downloadAllScripts();

    }
    
    getScriptsIn(scriptDirectory: Directory): Promise<Script[]> {
        throw new Error("Method not implemented.");
    }

    getDirectories(scriptDirectory: Directory): Promise<Directory[]> {
        throw new Error("Method not implemented.");
    }

    getAllDirectoriesFlatPath(): Promise<string[]> {
        return this.directoriesFlat;
    }

    private async getChildItems(scripts: ScriptObject[], prefix: string): Promise<Directory> {
        const prefixDirectoryCount = prefix.split(".").length;
        const currentLevelDirectories = scripts.filter(script => script.value._id.startsWith(prefix) && prefixDirectoryCount < script.value._id.split(".").length);
        const currentLevelScripts = scripts.filter(script => script.value._id.startsWith(prefix) && prefixDirectoryCount === script.value._id.split(".").length);

        const scriptDirectories = await this.convertToScriptDirectories(currentLevelDirectories, prefix);
        const scriptItems = this.convertToScriptItems(currentLevelScripts);

        let items: Array<ScriptItem | ScriptDirectory> = new Array();
        items = items.concat(scriptDirectories.filter(this.onlyUnique));
        items = items.concat(scriptItems);        

        return items;
    }

    private convertToScriptDirectory(scriptObject: ScriptObject, prefix: string): Directory {
        const prefixParts = prefix.split(".").length;
        const name = scriptObject.value._id.split(".")[prefixParts - 1];
        const directoryPath = `${prefix}${name}.`;

        return new Directory(name, directoryPath);
    }
}
