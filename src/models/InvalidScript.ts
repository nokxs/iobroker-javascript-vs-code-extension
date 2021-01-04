import { Common } from "./Common";
import { Script } from "./Script";
import { ScriptId } from "./ScriptId";

export class InvalidScript implements Script {

    constructor() {
        this.common = {};
        this._id = "INVALID";
    }

    common: Common;
    type?: string | undefined;
    from?: string | undefined;
    user?: string | undefined;
    _id: ScriptId;

}
