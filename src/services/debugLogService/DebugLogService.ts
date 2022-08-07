import * as fs from 'fs';

import { IDebugLogService } from "./IDebugLogService";
import { injectable } from "inversify";

@injectable()
export class DebugLogService implements IDebugLogService {
    private collecting = false;
    private logFileStream: fs.WriteStream | undefined = undefined;

    startCollecting(): void {
        this.collecting = true;
        this.endLogFileStream();
        this.logFileStream = fs.createWriteStream("debug.log.txt", {flags:'a'});
    }

    stopCollecting(): void {
        this.collecting = false;        
        this.endLogFileStream;
    }
    
    isCollecting(): boolean {
        return this.collecting;
    }
    
    log(message: string): void {
        if (this.collecting) {
            this.logFileStream?.write(`${new Date().toISOString()} - ${message}\n`);
        }
    }

    private endLogFileStream() {
        if (this.logFileStream) {
            this.logFileStream.end();
        }
        this.logFileStream = undefined;
    }
}
