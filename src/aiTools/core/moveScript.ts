import { ScriptId } from "../../models/ScriptId";
import { lastSegmentOf } from "../../models/ScriptIdPath";
import { failure, MoveScriptDto, MoveScriptInput, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { findDirectory, refreshScriptInCache, scriptIdOf, toFailure } from "./helpers";
import { toDirectoryId, toScriptId } from "./validation";

/** Moves a script into another directory on the ioBroker server and on disk. */
export async function moveScript(deps: ToolDeps, input: MoveScriptInput): Promise<ToolOutcome<MoveScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const directoryIdResult = toDirectoryId(input.targetDirectoryId, "targetDirectoryId");
    if (!directoryIdResult.ok) {
        return directoryIdResult;
    }

    const scriptId = scriptIdResult.data;
    const localScript = deps.scripts.getScriptFromId(scriptId);
    if (!localScript) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const targetDirectory = findDirectory(deps, directoryIdResult.data);
    if (!targetDirectory) {
        return failure("not_found", `The directory '${directoryIdResult.data}' is not known to the extension.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const oldScriptId = scriptIdOf(localScript);
    const newScriptId = `${targetDirectory._id}.${lastSegmentOf(oldScriptId)}`;

    if (newScriptId === oldScriptId) {
        return failure("invalid_input", `The script '${oldScriptId}' is already located in '${targetDirectory._id}'.`);
    }

    try {
        await deps.scriptRemote.move(scriptId, targetDirectory);
        const newFileUri = await deps.files.move(localScript, targetDirectory);

        await refreshScriptInCache(deps, scriptId);
        await refreshScriptInCache(deps, new ScriptId(newScriptId));

        return success({
            oldScriptId: oldScriptId,
            newScriptId: newScriptId,
            filePath: newFileUri.fsPath
        });
    } catch (error) {
        return toFailure(error);
    }
}
