import { ScriptId } from "../../../models/ScriptId";
import { failure, RemoteToolDeps, RenameScriptDto, RenameScriptInput, success, ToolOutcome } from "./types";
import { ensureRemoteConnected, refreshScriptInCache, scriptIdOf } from "./helpers";
import { toFailure } from "../helpers";
import { toScriptId, validateName } from "../validation";

/** Renames a script on the ioBroker server. The directory stays the same, no local file is moved. */
export async function renameScript(deps: RemoteToolDeps, input: RenameScriptInput): Promise<ToolOutcome<RenameScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const nameResult = validateName(input.newName, "newName");
    if (!nameResult.ok) {
        return nameResult;
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const scriptId = scriptIdResult.data;
    const newName = nameResult.data;
    const script = deps.scripts.getScriptFromId(scriptId);
    if (!script) {
        return failure("not_found", `The script '${scriptId}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const oldScriptId = scriptIdOf(script);
    const parentId = ScriptId.parentIdOf(oldScriptId);
    const newScriptId = `${parentId}.${ScriptId.sanitizeName(newName)}`;

    if (newScriptId === oldScriptId) {
        return failure("invalid_input", `The script is already called '${newName}'.`);
    }

    try {
        await deps.scriptRemote.rename(scriptId, newName);

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
