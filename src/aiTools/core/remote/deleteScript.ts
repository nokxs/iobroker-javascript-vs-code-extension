import { DeleteScriptDto, DeleteScriptInput, failure, RemoteToolDeps, success, ToolOutcome } from "./types";
import { ensureRemoteConnected, refreshScriptInCache, scriptIdOf } from "./helpers";
import { toFailure } from "../helpers";
import { toScriptId } from "../validation";

/** Deletes a script on the ioBroker server. There is no local file. */
export async function deleteScript(deps: RemoteToolDeps, input: DeleteScriptInput): Promise<ToolOutcome<DeleteScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const scriptId = scriptIdResult.data;
    const script = deps.scripts.getScriptFromId(scriptId);
    if (!script) {
        return failure("not_found", `The script '${scriptId}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    try {
        await deps.scriptRemote.delete(scriptId);
        await refreshScriptInCache(deps, scriptId);

        return success({ scriptId: scriptIdOf(script) });
    } catch (error) {
        return toFailure(error);
    }
}
