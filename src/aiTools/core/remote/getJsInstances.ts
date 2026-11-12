import { failure, GetJsInstancesDto, GetJsInstancesInput, JsInstanceDto, RemoteToolDeps, success, ToolOutcome } from "./types";
import { ensureRemoteConnected } from "./helpers";
import { toScriptId } from "../validation";

/** Lists the javascript adapter instances that can run scripts. */
export async function getJsInstances(deps: RemoteToolDeps, input: GetJsInstancesInput): Promise<ToolOutcome<GetJsInstancesDto>> {
    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    let currentInstanceId: string | null = null;

    if (input.scriptId !== undefined) {
        const scriptIdResult = toScriptId(input.scriptId);
        if (!scriptIdResult.ok) {
            return scriptIdResult;
        }

        const script = deps.scripts.getScriptFromId(scriptIdResult.data);
        if (!script) {
            return failure("not_found", `The script '${scriptIdResult.data}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available script ids.");
        }

        currentInstanceId = script.common.engine ?? null;
    }

    const instances = await deps.jsInstances.getAvailableInstances();

    return success({
        instances: instances.map<JsInstanceDto>(instance => ({ id: instance._id })),
        currentInstanceId: currentInstanceId
    });
}
