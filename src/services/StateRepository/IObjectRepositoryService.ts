import { IObjectList } from "../../models/IObjectList";

export interface IObjectRepositoryService {
    init(): Promise<void>;
    findMatchingObjects(partialId: string): IObjectList | undefined;
}
