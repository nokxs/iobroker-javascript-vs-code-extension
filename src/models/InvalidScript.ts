import { IScriptCommon } from "./IScriptCommon";
import { Script } from "./Script";
import { ScriptId } from "./ScriptId";

export class InvalidScript implements Script {

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
