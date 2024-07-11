import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IFileService } from "../services/file/IFileService";
import { IDirectoryService } from "../services/directory/IDirectoryService";
import { IConfigRepositoryService } from "../services/configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { CreateDirectoryCommand } from "./CreateDirectoryCommand";

@injectable()
export class CreateDirectoryInRootCommand implements ICommand {
    id: string = "iobroker-javascript.view.scriptExplorer.createDirectoryInRoot";
    
    constructor(        
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.file) private fileService: IFileService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute(...args: any[]) {
       new CreateDirectoryCommand(this.directoryService, this.fileService, this.configRepositoryService, this.workspaceService).execute(...args);
    }
}
