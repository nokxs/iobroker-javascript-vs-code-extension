import { failure, GetJsInstancesDto, GetJsInstancesInput, JsInstanceDto, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { toScriptId } from "./validation";

/** Lists the javascript adapter instances that can run scripts. */
export async function getJsInstances(deps: ToolDeps, input: GetJsInstancesInput): Promise<ToolOutcome<GetJsInstancesDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    let currentInstanceId: string | null = null;

    if (input.scriptId !== undefined) {
        const scriptIdResult = toScriptId(input.scriptId);
        if (!scriptIdResult.ok) {
            return scriptIdResult;
        }

        const localScript = deps.scripts.getScriptFromId(scriptIdResult.data);
        if (!localScript) {
            return failure("not_found", `The script '${scriptIdResult.data}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
        }

        currentInstanceId = localScript.ioBrokerScript.common.engine ?? null;
    }

    const instances = await deps.jsInstances.getAvailableInstances();

    return success({
        instances: instances.map<JsInstanceDto>(instance => ({ id: instance._id })),
        currentInstanceId: currentInstanceId
    });
}
