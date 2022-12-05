import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { IStateAndObjectRemoteService } from "./IStateAndObjectRemoteService";
import { IState } from "../../models/IState";
import { IObjectList } from "../../models/IObjectList";

@injectable()
export class StateAndObjectRemoteService implements IStateAndObjectRemoteService, IConnectionEventListener {
    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider
    ) {}

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
        // this.connectionServiceProvider.getConnectionService().registerForObjectChange("script.js.*", (id: string) => {
        //     this.scriptEventListeners.forEach(listener => listener.onScriptChanged(id));
        // });
    }

    private unregisterSocketEvents(): void {
        // this.connectionServiceProvider.getConnectionService().unregisterObjectChange("script.js.*");
    }
}
