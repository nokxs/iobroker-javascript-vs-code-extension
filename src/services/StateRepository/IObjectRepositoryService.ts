import { IObject } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";

export interface IObjectRepositoryService {
    /** Loads the object index once per session; repeated calls are no-ops. */
    init(): Promise<void>;
    /** Downloads the object index again, even if it is loaded already. */
    rebuild(): Promise<void>;
    isLoaded(): boolean;
    getObjectCount(): number;
    findMatchingObjectsByPartialIdAndName(partialId: string): IObjectList | undefined;
    getObjectById(id: string): IObject | undefined;
}
