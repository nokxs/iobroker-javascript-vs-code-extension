import { IStateCommon } from "./IStateCommon";

export interface IState {
    common: IStateCommon;
    type?: string;
    from?: string;
    user?: string;
    ts?: number;
    _id: string;
}