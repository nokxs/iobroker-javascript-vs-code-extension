import { IObject } from "./IObject";


export interface IObjectList {
    [id: string]: IObject | undefined;
}
