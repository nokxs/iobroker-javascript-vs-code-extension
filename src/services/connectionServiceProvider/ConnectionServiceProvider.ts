import { inject, injectable } from "inversify";
import { AdminVersion } from "../../models/Config";
import TYPES from "../../Types";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { ConnectionServiceAdmin4 } from "../connection/ConnectionServiceAdmin4";
import { ConnectionServiceAdmin5 } from "../connection/ConnectionServiceAdmin5";
import { IConnectionService } from "../connection/IConnectionService";
import { IConnectionServiceProvider } from "./IConnectionServiceProvider";

@injectable()
export class ConnectionServiceProvider implements IConnectionServiceProvider {
    constructor(
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.connectionAdmin4) private connectionServiceAdmin4: ConnectionServiceAdmin4,
        @inject(TYPES.services.connectionAdmin5) private connectionServiceAdmin5: ConnectionServiceAdmin5
    ) {}

    isConnectionServiceAvailable(): boolean {
        return this.configRepositoryService.config && 
            this.configRepositoryService.config.adminVersion && 
            this.configRepositoryService.config.adminVersion !== AdminVersion.unknown;
    }

    getConnectionService(): IConnectionService {
        const adminVersion = this.configRepositoryService.config.adminVersion;

         if (adminVersion === AdminVersion.admin4) {
             return this.connectionServiceAdmin4;
         }
         
        if (adminVersion === AdminVersion.admin5 || adminVersion === AdminVersion.admin6 || adminVersion === AdminVersion.admin7) {
            return this.connectionServiceAdmin5;
        }

        throw new Error(`Cannot determine which connection service to use. Configured admin version: ${adminVersion}`);
     }
}
