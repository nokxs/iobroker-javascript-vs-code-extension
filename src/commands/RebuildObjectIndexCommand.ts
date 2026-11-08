import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class RebuildObjectIndexCommand implements ICommand {
    id: string = "iobroker-javascript.rebuildObjectIndex";

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
    ) {}
    
    async execute() {
        await this.iobrokerConnectionService.rebuildObjectIndex();
    }
}
