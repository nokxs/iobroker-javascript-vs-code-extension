import { ScriptId } from "../../models/ScriptId";
import { failure, RenameScriptDto, RenameScriptInput, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { extensionOf, refreshScriptInCache, sanitizeScriptName, scriptIdOf, toFailure } from "./helpers";
import { toScriptId, validateName } from "./validation";

/** Renames a script on the ioBroker server and the local file. The directory stays the same. */
export async function renameScript(deps: ToolDeps, input: RenameScriptInput): Promise<ToolOutcome<RenameScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const nameResult = validateName(input.newName, "newName");
    if (!nameResult.ok) {
        return nameResult;
    }

    const scriptId = scriptIdResult.data;
    const newName = nameResult.data;
    const localScript = deps.scripts.getScriptFromId(scriptId);
    if (!localScript) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const oldScriptId = scriptIdOf(localScript);
    const parentId = ScriptId.parentIdOf(oldScriptId);
    const newScriptId = `${parentId}.${sanitizeScriptName(newName)}`;
    const fileExtension = extensionOf(localScript, deps);

    if (newScriptId === oldScriptId) {
        return failure("invalid_input", `The script is already called '${newName}'.`);
    }

    try {
        await deps.scriptRemote.rename(scriptId, newName);
        const newFileUri = await deps.files.rename(localScript, newName, fileExtension);

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
