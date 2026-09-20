import { IJsInstance } from "../../models/IJsInstance";
import { ScriptId } from "../../models/ScriptId";

export interface IJsInstanceService {
    getAvailableInstances(): Promise<IJsInstance[]>;
    changeInstance(scriptId: ScriptId, jsInstance: IJsInstance): Promise<void>;
}
