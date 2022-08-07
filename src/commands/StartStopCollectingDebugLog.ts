import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IDebugLogService } from "../services/debugLogService/IDebugLogService";

@injectable()
export class StartStopCollectingDebugLog implements ICommand {
    id: string = "iobroker-javascript.startStopDebugLog";
    
    constructor(
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService
    ) {}
    
    async execute() {
        if (this.debugLogService.isCollecting()) {
            this.debugLogService.stopCollecting();
        }
        else {
            this.debugLogService.startCollecting();
        }
    }
}
