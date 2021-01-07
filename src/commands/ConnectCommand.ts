import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IConnectionService } from "../services/connection/IConnectionService";
import { IWorkspaceService } from "../services/workspace/IWorkspaceService";
import { IScriptService } from "../services/script/IScriptService";

@injectable()
export class ConnectCommand implements ICommand {
    id: string = "iobroker-javascript.connect";

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}
    
    async execute() {
        
    }
}
