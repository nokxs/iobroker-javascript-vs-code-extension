import { IObject } from "../../models/IObject";
import { IState } from "../../models/IState";

export interface IStateAndObjectRemoteService {
    getState(id: string): Promise<IState>;
    getAllObjects(): Promise<IObject[]>;
}
