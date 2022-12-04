import { inject, injectable } from "inversify";
import { IObject } from "../../models/IObject";
import TYPES from "../../Types";
import { IStateRemoteService as IStat../stateRemote/IStateAndObjectRemoteService/stateRemote/IStateRemoteService";
import { IStateRepositorService as IObjectRepositorService } from "./IObjectRepositoryService";

@injectable()
export class ObjectRepositoryService implements IObjectRepositorService {
    private _allStates: IObject[] = [];
    
    constructor(
        @inject(TYPES.services.StateAndObjectRemoteService) private stateRemoteService: IStateAndObjectRemoteService,
    ) { }

    async init() {
        this._allStates = await this.stateRemoteService.getAllObjects();
    }

    getObject(id: string): IObject | undefined {
        return this._allStates.find(state => state._id === id);
    }
}