import { IObject } from "../../models/IObject";

export interface IStateAndObjectRemoteService {
    getAllObjects(): Promise<IObject[]>;
}
