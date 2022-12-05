import { inject, injectable } from "inversify";
import { IObject } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";
import TYPES from "../../Types";
import { IStateAndObjectRemoteService } from "../stateRemote/IStateAndObjectRemoteService";
import { IObjectRepositoryService } from "./IObjectRepositoryService";

type ObjectRepositoryDictionary = {
    [key: string]: IObjectRepositoryItem;
};

export interface IObjectRepositoryItem {
    item: IObject | undefined;
    children: ObjectRepositoryDictionary;
}


@injectable()
export class ObjectRepositoryService implements IObjectRepositoryService {
    private _allObjectsPlain: IObjectList = {};
    private _allObjects: ObjectRepositoryDictionary = {};
    
    constructor(
        @inject(TYPES.services.stateAndObjectRemoteService) private stateRemoteService: IStateAndObjectRemoteService,
    ) { }

    async init(): Promise<void> {
        this._allObjectsPlain = await this.stateRemoteService.getAllObjects();

        for (const id in this._allObjectsPlain) {
            const idParts = id.split(".");
            let lastRepositoryItem: IObjectRepositoryItem = { item: undefined, children: this._allObjects};

            for (const idPart of idParts) {
                lastRepositoryItem = this.handleIdPart(lastRepositoryItem.children, idPart);
            }

            lastRepositoryItem.item = this._allObjectsPlain[id];
        }
    }

    private handleIdPart(states: ObjectRepositoryDictionary, part: string): IObjectRepositoryItem {
        let item = states[part];
       
        if (!item) {
            item = {
                item: undefined,
                children: {} 
            };

            states[part] = item;
        }

        return item;
    }

    findMatchingObjects(partialId: string): IObjectList | undefined {
        const idParts = partialId.split(".");

        let currentObjectDictionary: ObjectRepositoryDictionary = this._allObjects;
        for (const idPart of idParts) {
            var item = currentObjectDictionary[idPart];
            
            // first, iterate through tree, till no matching part is found
            if (item) {
                currentObjectDictionary = item.children;
            }
            // then use partial id part for filtering
            else {
                const keys = Object.keys(currentObjectDictionary);
                const matchingKeys = keys.filter(key => key.startsWith(idPart));
                const result: IObjectList= {};
                
                for (const key of matchingKeys) {
                    result[key] = currentObjectDictionary[key].item;
                }

                return result;
            }
        }

        return undefined;
    }
}