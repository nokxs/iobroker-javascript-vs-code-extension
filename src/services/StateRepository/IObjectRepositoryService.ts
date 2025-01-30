import { IObject } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";

export interface IObjectRepositoryService {
    init(): Promise<void>;
    findMatchingObjects(partialId: string): IObjectList | undefined;
    getObjectById(id: string): IObject | undefined;
}
