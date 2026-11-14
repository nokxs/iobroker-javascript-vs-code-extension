import { IObjectCommon } from "./IObjectCommon";

export interface IObject {
    common: IObjectCommon;
    type?: string;
    from?: string;
    user?: string;
    ts?: number;
}

/**
 * An object as `getObjectView` returns it: ioBroker keeps the id inside the object, the view call
 * does not return the key next to the value.
 */
export interface IObjectWithId extends IObject {
    _id: string;
}
