import { IObjectList } from "../../models/IObjectList";
import { IState } from "../../models/IState";
import { IObjectChangedEventListener } from "./IObjectChangedEventListener";

export interface IStateAndObjectRemoteService {
    init(): void

    registerObjectChangedEventListener(listener: IObjectChangedEventListener): void

    getState(id: string): Promise<IState>;
    getAllObjects(): Promise<IObjectList>;
}
