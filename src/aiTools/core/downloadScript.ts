import { DownloadScriptDto, DownloadScriptInput, failure, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { filePathOf, refreshScriptInCache, toFailure } from "./helpers";
import { toScriptId } from "./validation";

/**
 * Writes the content from the ioBroker server to the local file.
 * Refuses to run when the editor holds unsaved changes for that file, because writing would
 * silently discard them.
 */
export async function downloadScript(deps: ToolDeps, input: DownloadScriptInput): Promise<ToolOutcome<DownloadScriptDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const scriptId = scriptIdResult.data;
    const localScript = deps.scripts.getScriptFromId(scriptId);
    if (!localScript) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    if (deps.documents.isDirty(filePathOf(localScript))) {
        const filePath = filePathOf(localScript);
        return failure(
            "unsaved_changes",
            `The file '${filePath}' has unsaved editor changes, so downloading would discard them.`,
            `Ask the user to save, revert or close '${filePath}' and retry afterwards.`);
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        const remoteScript = await deps.scriptRemote.downloadScriptWithId(scriptId);
        if (!remoteScript) {
            return failure("not_found", `The script '${scriptId}' does not exist on the ioBroker server.`);
        }

        const source = remoteScript.common.source ?? "";
        await deps.files.writeContent(localScript.absoluteUri, source);
        await refreshScriptInCache(deps, scriptId);

        return success({
            scriptId: `${scriptId}`,
            filePath: filePathOf(localScript),
            characters: source.length
        });
    } catch (error) {
        return toFailure(error);
    }
}
