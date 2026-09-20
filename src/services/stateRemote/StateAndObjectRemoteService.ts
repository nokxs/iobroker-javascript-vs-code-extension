import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { IStateAndObjectRemoteService } from "./IStateAndObjectRemoteService";
import { IState } from "../../models/IState";
import { IObjectList } from "../../models/IObjectList";
import { IObjectChangedEventListener } from "./IObjectChangedEventListener";

@injectable()
export class StateAndObjectRemoteService implements IStateAndObjectRemoteService, IConnectionEventListener {
    private objectEventListeners: Array<IObjectChangedEventListener> = [];

    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider
    ) {}

    registerObjectChangedEventListener(listener: IObjectChangedEventListener): void {
        if (this.objectEventListeners.includes(listener)) {
            return;
        }
        
        this.objectEventListeners.push(listener);
    }

    init(): void {
        this.connectionServiceProvider.getConnectionService().registerConnectionEventListener(this);

        if (this.connectionServiceProvider.getConnectionService().isConnected) {
            this.registerSocketEvents();
        }
    }

    getAllObjects(): Promise<IObjectList> {
        return this.connectionServiceProvider.getConnectionService().getAllObjects();
    }

    getState(id: string): Promise<IState> {
        return this.connectionServiceProvider.getConnectionService().getState(id);
    }

    onConnected(): void {
        this.registerSocketEvents();
    }

    onDisconnected(): void {
        this.unregisterSocketEvents();
    }

    onReAuthenticate(): void {
    }

    private registerSocketEvents(): void {
        this.connectionServiceProvider.getConnectionService().registerForObjectChange("*", (id: string, value:  any) => {
            this.objectEventListeners.forEach(listener => listener.onObjectChanged(id, value));
        });
    }

    private unregisterSocketEvents(): void {
        this.connectionServiceProvider.getConnectionService().unregisterObjectChange("*");
    }
}
