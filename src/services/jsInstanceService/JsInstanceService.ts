
import { inject, injectable } from "inversify";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import TYPES from "../../Types";
import { IJsInstanceService } from "./IJsInstanceService";
import { IJsInstance } from "../../models/IJsInstance";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";


@injectable()
export class JsInstanceService implements IJsInstanceService {
    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider
    ) {}

    getAvailableInstances(): Promise<IJsInstance[]> {
        return this.connectionServiceProvider.getConnectionService().getSystemObjectView<IJsInstance>("instance", "system.adapter.javascript", "system.adapter.javascript.");
    }

    changeInstance(scriptId: ScriptId, jsInstance: IJsInstance): Promise<void> {
        const script: IScript = {
            _id: scriptId,
            common: {
                engine: jsInstance._id
            }
        };
        
        return this.connectionServiceProvider.getConnectionService().extendObject(scriptId, script);
    }
}


