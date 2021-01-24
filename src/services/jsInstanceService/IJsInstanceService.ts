import { JsInstance } from "../../models/JsInstance";
import { ScriptId } from "../../models/ScriptId";

export interface IJsInstanceService {
    getAvailableInstances(): Promise<JsInstance[]>;
    changeInstance(scriptId: ScriptId, jsInstance: JsInstance): Promise<void>;
}
