import { IScriptCommon } from "./IScriptCommon";
import { IScript } from "./IScript";
import { ScriptId } from "./ScriptId";

export class InvalidScript implements IScript {

    constructor() {
        this.common = {};
        this._id = "INVALID";
    }

    common: IScriptCommon;
    type?: string | undefined;
    from?: string | undefined;
    user?: string | undefined;
    _id: ScriptId;

}
