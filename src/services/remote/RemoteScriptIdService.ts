import { ScriptId } from "../../models/ScriptId";
import { IScriptIdService } from "../scriptId/IScriptIdService";

/**
 * The id rules themselves live on `ScriptId`. Only `getIoBrokerId` needs a workspace and is never
 * called by the server.
 */
export class RemoteScriptIdService implements IScriptIdService {
    getIoBrokerId(): ScriptId {
        throw new Error("getIoBrokerId needs a workspace and is not available in the MCP server.");
    }

    sanatizeId(scriptId: ScriptId): ScriptId {
        return ScriptId.sanitizeId(scriptId);
    }
}
