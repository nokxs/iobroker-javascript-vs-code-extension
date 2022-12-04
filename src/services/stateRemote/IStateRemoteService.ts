import { IObject } from "../../models/IObject";

export interface IStateRemoteService {
    getAllStates(): Promise<IObject[]>;
}
