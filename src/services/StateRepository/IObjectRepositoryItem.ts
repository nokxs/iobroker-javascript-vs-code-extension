import { IObject } from "../../models/IObject";
import { ObjectRepositoryDictionary } from "./ObjectRepositoryDictionary";


export interface IObjectRepositoryItem {
    item: IObject | undefined;
    children: ObjectRepositoryDictionary;
}
