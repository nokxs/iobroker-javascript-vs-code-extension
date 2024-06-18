import { IObjectCommon } from "./IObjectCommon";

export interface IObject {
    common: IObjectCommon;
    type?: string;
    from?: string;
    user?: string;
    ts?: number;
}