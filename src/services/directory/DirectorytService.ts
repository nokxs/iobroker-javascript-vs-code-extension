
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IDirectoryService } from "./IDirectoryService";
import { IConnectionService } from "../connection/IConnectionService";
import { IDirectory } from "../../models/IDirectory";
import { ScriptId } from "../../models/ScriptId";

@injectable()
export class DirectoryService implements IDirectoryService {
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
    ) {}

    downloadDirectory(id: ScriptId): Promise<IDirectory> {
        return this.connectionService.getObject(id);
    }
        
    downloadAllDirectories(): Promise<IDirectory[]> {
        return this.connectionService.getSystemObjectView<IDirectory>("channel", "script.js.", "script.js.");
    }

    createDirectory(id: ScriptId, name: string): Promise<void> {
        return this.connectionService.setObject(id, {
            "common": {
              "name": name,
              "expert": true
            },
            "type": "channel",
            "from": "system.adapter.admin.0",
            "user": "system.user.admin",
            "_id": id,
            "acl": {
              "object": 1636,
              "owner": "system.user.admin",
              "ownerGroup": "system.group.administrator"
            },
            "native": {}
          });
    }

    async createDirectoriesRecursively(scriptId: ScriptId): Promise<void> {
        const parts = scriptId.split(".");
        // start with index 3, to ignore the prefix 'script.js' and start with the first directory
        for (let i = 3; i <= parts.length; i++) {
            const remainingParts = parts.slice(0, i);
            const directoryId = remainingParts.join(".");
            const directory = await this.downloadDirectory(directoryId);
            if (!directory) {
                await this.createDirectory(directoryId, parts[i - 1]);
            }
        }
    }
}
