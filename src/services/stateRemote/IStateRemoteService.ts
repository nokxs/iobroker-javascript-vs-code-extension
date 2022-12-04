import { IState } from "../../models/IState";

export interface IStateRemoteService {
    getAllStates(): Promise<IState[]>;
}
