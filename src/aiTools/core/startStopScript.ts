import { failure, ScriptStateDto, StartStopScriptInput, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { refreshScriptInCache, toFailure } from "./helpers";
import { toScriptId } from "./validation";

/** Enables a script on the ioBroker server, so the javascript adapter runs it. */
export async function startScript(deps: ToolDeps, input: StartStopScriptInput): Promise<ToolOutcome<ScriptStateDto>> {
    return setScriptEnabled(deps, input.scriptId, true);
}

/** Disables a script on the ioBroker server, so the javascript adapter stops it. */
export async function stopScript(deps: ToolDeps, input: StartStopScriptInput): Promise<ToolOutcome<ScriptStateDto>> {
    return setScriptEnabled(deps, input.scriptId, false);
}

async function setScriptEnabled(deps: ToolDeps, rawScriptId: string, enabled: boolean): Promise<ToolOutcome<ScriptStateDto>> {
    const scriptIdResult = toScriptId(rawScriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const scriptId = scriptIdResult.data;
    if (!deps.scripts.getScriptFromId(scriptId)) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        if (enabled) {
            await deps.scriptRemote.startScript(scriptId);
        } else {
            await deps.scriptRemote.stopScript(scriptId);
        }

        await refreshScriptInCache(deps, scriptId);

        return success({ scriptId: `${scriptId}`, enabled: enabled });
    } catch (error) {
        return toFailure(error);
    }
}
