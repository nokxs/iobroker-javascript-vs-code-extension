import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IConfigService } from "../services/config/IConfigService";
import { IFileService } from "../services/file/IFileService";

@injectable()
export class UploadAllCommand implements ICommand {
    id: string = "iobroker-javascript.uploadAll";
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.config) private configService: IConfigService
    ) {}

    execute(...args: any[]) {
    }

}