import { failure, RemoteToolDeps, success, ToolOutcome, UpdateScriptSourceDto, UpdateScriptSourceInput } from "./types";
import { ensureRemoteConnected, refreshScriptInCache, scriptIdOf } from "./helpers";
import { toFailure } from "../helpers";
import { toScriptId } from "../validation";
import { IScript } from "../../../models/IScript";
import { MAX_SCRIPT_SOURCE_LENGTH } from "./types";

/**
 * Replaces `common.source` of an existing script. This is the remote replacement for the upload
 * tool of the extension: the agent edits the source directly instead of a local file.
 */
export async function updateScriptSource(deps: RemoteToolDeps, input: UpdateScriptSourceInput): Promise<ToolOutcome<UpdateScriptSourceDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    if (typeof input.source !== "string") {
        return failure("invalid_input", "'source' must be a string.");
    }

    if (input.source.length > MAX_SCRIPT_SOURCE_LENGTH) {
        return failure(
            "invalid_input",
            `'source' must not be longer than ${MAX_SCRIPT_SOURCE_LENGTH} characters, but was ${input.source.length}.`,
            "Split the script into smaller scripts or shorten it before retrying.");
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

    const update: IScript = {
        _id: scriptId,
        common: { source: input.source }
    };

    try {
        await deps.scriptRemote.update(scriptId, update);
        await refreshScriptInCache(deps, scriptId);

        return success({
            scriptId: scriptIdOf(script),
            characters: input.source.length
        });
    } catch (error) {
        return toFailure(error);
    }
}
