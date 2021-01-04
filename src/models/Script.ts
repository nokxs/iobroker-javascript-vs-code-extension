import { Common } from "./Common";
import { ScriptId } from "./ScriptId";

export interface Script {
    common: Common;
    type?: string;
    from?: string;
    user?: string;
    _id: ScriptId;
}

