import { IObject } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";

export interface IObjectRepositoryService {
    init(): Promise<void>;
    findMatchingObjectsByPartialIdAndName(partialId: string): IObjectList | undefined;
    getObjectById(id: string): IObject | undefined;
}
