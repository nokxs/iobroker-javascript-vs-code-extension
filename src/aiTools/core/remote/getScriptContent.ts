import {
    failure,
    GetScriptContentDto,
    GetScriptContentInput,
    MAX_SCRIPT_CONTENT_LENGTH,
    RemoteToolDeps,
    success,
    ToolOutcome
} from "./types";
import { ensureRemoteConnected, scriptIdOf, scriptNameOf } from "./helpers";
import { toBoundedInteger, toScriptId } from "../validation";

/** Returns the source of a script from the ioBroker object. There is no local file to prefer. */
export async function getScriptContent(deps: RemoteToolDeps, input: GetScriptContentInput): Promise<ToolOutcome<GetScriptContentDto>> {
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

    const maxLength = toBoundedInteger(input.maxLength, MAX_SCRIPT_CONTENT_LENGTH, 1, Number.MAX_SAFE_INTEGER);
    const source = script.common.source ?? "";
    const truncated = source.length > maxLength;

    return success({
        scriptId: scriptIdOf(script),
        name: scriptNameOf(script),
        source: truncated ? source.substring(0, maxLength) : source,
        truncated: truncated
    });
}
