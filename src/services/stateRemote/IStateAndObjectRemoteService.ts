import { IObjectList } from "../../models/IObjectList";
import { IState } from "../../models/IState";

export interface IStateAndObjectRemoteService {
    getState(id: string): Promise<IState>;
    getAllObjects(): Promise<IObjectList>;
}
