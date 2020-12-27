import { IConnectionEventListener, IConnectionService } from "./IConnectionService";

import { Script } from "../../models/script";
import { injectable } from "inversify";

@injectable()
export class ConnectionService implements IConnectionService {
    isConnected: Boolean = false;

    registerEventListener(listener: IConnectionEventListener): void {
        throw new Error("Method not implemented.");
    }
    
    connect(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    disconnect(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    downloadAllScripts(): Promise<Script[]> {
        throw new Error("Method not implemented.");
    }

    downloadScript(scriptPath: String): Promise<Script> {
        throw new Error("Method not implemented.");
    }

    uploadScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    startScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    stopScript(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }

    registerForLogs(script: Script, logAction: () => {}): Promise<void> {
        throw new Error("Method not implemented.");
    }

    unregisterForLogs(script: Script): Promise<void> {
        throw new Error("Method not implemented.");
    }    
}