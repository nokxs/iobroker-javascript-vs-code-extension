import { IConnectionService } from "../connection/IConnectionService";

export interface IConnectionServiceProvider {
    isConnectionServiceAvailable(): boolean
    getConnectionService(): IConnectionService
}
