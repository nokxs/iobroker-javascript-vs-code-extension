
import { inject, injectable } from "inversify";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IConnectionService } from "../connection/IConnectionService";
import { IJsInstanceService } from "./IJsInstanceService";
import { IJsInstance } from "../../models/IJsInstance";


@injectable()
export class JsInstanceService implements IJsInstanceService {
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService
    ) {}

    getAvailableInstances(): Promise<IJsInstance[]> {
        return this.connectionService.getSystemObjectView<IJsInstance>("instance", "system.adapter.javascript", "system.adapter.javascript.");
    }

    changeInstance(scriptId: ScriptId, jsInstance: IJsInstance): Promise<void> {
        const script: IScript = {
            _id: scriptId,
            common: {
                engine: jsInstance._id
            }
        };
        
        return this.connectionService.extendObject(scriptId, script);
    }
}


