import { DeleteScriptDto, DeleteScriptInput, failure, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { filePathOf, refreshScriptInCache, scriptIdOf, toFailure } from "./helpers";
import { toScriptId } from "./validation";

/** Deletes a script on the ioBroker server and the local file. */
export async function deleteScript(deps: ToolDeps, input: DeleteScriptInput): Promise<ToolOutcome<DeleteScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const scriptId = scriptIdResult.data;
    const localScript = deps.scripts.getScriptFromId(scriptId);
    if (!localScript) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const filePath = filePathOf(localScript);

    try {
        await deps.scriptRemote.delete(scriptId);
        const fileWasDeleted = await deps.files.delete(localScript);
        await refreshScriptInCache(deps, scriptId);

        return success({
            scriptId: scriptIdOf(localScript),
            deletedFilePath: fileWasDeleted ? filePath : null
        });
    } catch (error) {
        return toFailure(error);
    }
}
