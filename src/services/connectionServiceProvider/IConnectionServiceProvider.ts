import { IConnectionService } from "../connection/IConnectionService";

export interface IConnectionServiceProvider {
    getConnectionService(): IConnectionService
}
