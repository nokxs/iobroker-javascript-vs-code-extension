
import { inject, injectable } from "inversify";
import { Script } from "../../models/Script";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IConnectionService } from "../connection/IConnectionService";
import { IJsInstanceService } from "./IJsInstanceService";
import { JsInstance } from "../../models/JsInstance";


@injectable()
export class JsInstanceService implements IJsInstanceService {
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService
    ) {}

    getAvailableInstances(): Promise<JsInstance[]> {
        return this.connectionService.getSystemObjectView<JsInstance>("instance", "system.adapter.javascript", "system.adapter.javascript.");
    }

    changeInstance(scriptId: ScriptId, jsInstance: JsInstance): Promise<void> {
        const script: Script = {
            _id: scriptId,
            common: {
                engine: jsInstance._id
            }
        };
        
        return this.connectionService.extendObject(scriptId, script);
    }
}


