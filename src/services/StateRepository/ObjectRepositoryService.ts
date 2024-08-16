import { inject, injectable } from "inversify";
import { IObject } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";
import TYPES from "../../Types";
import { IObjectChangedEventListener } from "../stateRemote/IObjectChangedEventListener";
import { IStateAndObjectRemoteService } from "../stateRemote/IStateAndObjectRemoteService";
import { IObjectRepositoryItem } from "./IObjectRepositoryItem";
import { IObjectRepositoryService } from "./IObjectRepositoryService";
import { ObjectRepositoryDictionary } from "./ObjectRepositoryDictionary";

@injectable()
export class ObjectRepositoryService implements IObjectRepositoryService, IObjectChangedEventListener {
    private allObjectsPlain: IObjectList = {};
    private allObjects: ObjectRepositoryDictionary = {};
    
    constructor(
        @inject(TYPES.services.stateAndObjectRemoteService) private stateRemoteService: IStateAndObjectRemoteService,
    ) { }

    async init(): Promise<void> {
        this.allObjectsPlain = await this.stateRemoteService.getAllObjects();

        for (const id in this.allObjectsPlain) {
            this.handleId(id);
        }

        this.stateRemoteService.registerObjectChangedEventListener(this);
    }

    findMatchingObjects(partialId: string): IObjectList | undefined {
        const idParts = partialId.split(".");

        let currentObjectDictionary: ObjectRepositoryDictionary = this.allObjects;
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

    getObjectById(id: string): IObject | undefined {
        const idParts = id.split(".");
        let currentObjectDictionary: ObjectRepositoryDictionary = this.allObjects;
        let foundItem = undefined;
        for (const idPart of idParts) {
            foundItem = currentObjectDictionary[idPart];

            if (foundItem?.children) {                
                currentObjectDictionary = foundItem.children;
            }
            else {
                return undefined;
            }
        }

        return foundItem?.item;
    }

    onObjectChanged(id: string | undefined, value: IObject | undefined): void {
        if(!id) {
            return;
        }

        // value was added or changed
        if (value) {
            this.allObjectsPlain[id] = value;
            this.handleId(id);            
        }
        // value was deleted
        else {
            this.deleteFromAllObjectsPlain(id);            
            this.deleteFromAllObjects(id);
        }
    }

    private deleteFromAllObjectsPlain(id: string) {
        delete this.allObjectsPlain[id];
    }

    private deleteFromAllObjects(id: string) {
        const idParts = id.split(".");
        const lastIdPart = idParts.pop();

        if (lastIdPart) {
            let lastRepositoryItem: IObjectRepositoryItem = { item: undefined, children: this.allObjects };
            for (const idPart of idParts) {
                lastRepositoryItem = lastRepositoryItem.children[idPart];

                if(!lastRepositoryItem) {
                    // there is nothing to delete
                    return;
                }
            }
                
            delete lastRepositoryItem.children[lastIdPart];
        }
    }

    private handleId(id: string) {
        const idParts = id.split(".");
        let lastRepositoryItem: IObjectRepositoryItem = { item: undefined, children: this.allObjects};

        for (const idPart of idParts) {
            lastRepositoryItem = this.handleIdPart(lastRepositoryItem.children, idPart);
        }

        lastRepositoryItem.item = this.allObjectsPlain[id];
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
}