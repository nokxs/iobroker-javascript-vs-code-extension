import { IScriptCommon } from "./IScriptCommon";
import { ScriptId } from "./ScriptId";

export interface IScript {
    common: IScriptCommon;
    type?: string;
    from?: string;
    user?: string;
    _id: ScriptId;
}
