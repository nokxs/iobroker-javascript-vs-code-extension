import { IScriptCommon } from "./ICommon";
import { ScriptId } from "./ScriptId";

export interface Script {
    common: IScriptCommon;
    type?: string;
    from?: string;
    user?: string;
    _id: ScriptId;
}
