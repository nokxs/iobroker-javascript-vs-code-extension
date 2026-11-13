import { ScriptId } from "../../../models/ScriptId";
import { failure, MoveScriptDto, MoveScriptInput, RemoteToolDeps, success, ToolOutcome } from "./types";
import { ensureRemoteConnected, findDirectory, refreshScriptInCache, scriptIdOf } from "./helpers";
import { toFailure } from "../helpers";
import { toDirectoryId, toScriptId } from "../validation";

/** Moves a script into another directory on the ioBroker server. There is no local file. */
export async function moveScript(deps: RemoteToolDeps, input: MoveScriptInput): Promise<ToolOutcome<MoveScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const directoryIdResult = toDirectoryId(input.targetDirectoryId, "targetDirectoryId");
    if (!directoryIdResult.ok) {
        return directoryIdResult;
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

    const targetDirectory = findDirectory(deps, directoryIdResult.data);
    if (!targetDirectory) {
        return failure("not_found", `The directory '${directoryIdResult.data}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const oldScriptId = scriptIdOf(script);
    const newScriptId = `${targetDirectory._id}.${ScriptId.lastSegmentOf(oldScriptId)}`;

    if (newScriptId === oldScriptId) {
        return failure("invalid_input", `The script '${oldScriptId}' is already located in '${targetDirectory._id}'.`);
    }

    try {
        await deps.scriptRemote.move(scriptId, targetDirectory);

        await refreshScriptInCache(deps, scriptId);
        await refreshScriptInCache(deps, new ScriptId(newScriptId));

        return success({
            oldScriptId: oldScriptId,
            newScriptId: newScriptId
        });
    } catch (error) {
        return toFailure(error);
    }
}
