
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
    
    downloadAllDirectories(): Promise<IDirectory[]> {
        return this.connectionService.getSystemObjectView<IDirectory>("channel", "script.js.", "script.js.");
    }    
}
