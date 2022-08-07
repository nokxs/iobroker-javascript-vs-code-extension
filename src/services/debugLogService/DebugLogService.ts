import { injectable, inject } from "inversify";
import TYPES from "../../Types";
import { IFileService } from "../file/IFileService";
import { IDebugLogService } from "./IDebugLogService";

@injectable()
export class DebugLogService implements IDebugLogService {
    constructor(
        @inject(TYPES.services.file) private fileService: IFileService
    ) {}

    startCollecting(): void {
        throw new Error("Method not implemented.");
    }

    stopCollecting(): void {
        throw new Error("Method not implemented.");
    }
    
    isCollecting(): boolean {
        throw new Error("Method not implemented.");
    }
    
    log(message: string): void {
        throw new Error("Method not implemented.");
    }
}
