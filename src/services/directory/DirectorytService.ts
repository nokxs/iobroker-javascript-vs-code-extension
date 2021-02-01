
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IDirectoryService } from "./IDirectoryService";
import { IConnectionService } from "../connection/IConnectionService";
import { IDirectory } from "../../models/IDirectory";

@injectable()
export class DirectoryService implements IDirectoryService {
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
    ) {}
    
    async downloadAllDirectories(): Promise<IDirectory[]> {
        const directoryObjects = await this.connectionService.getSystemObjectView<{value: IDirectory}>("channel", "script.js.", "script.js.");
        return directoryObjects.map(so => so.value);
    }
    
}
