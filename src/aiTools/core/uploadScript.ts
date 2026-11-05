import { failure, success, ToolDeps, ToolOutcome, UploadScriptInput, UploadScriptsDto } from "./types";
import { ensureConnected } from "./connection";
import { scriptIdOf, toFailure } from "./helpers";
import { toScriptId } from "./validation";

/** Uploads a single script from disk to the ioBroker server. */
export async function uploadScript(deps: ToolDeps, input: UploadScriptInput): Promise<ToolOutcome<UploadScriptsDto>> {
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

    try {
        const script = await deps.scripts.getScriptWithLocalContent(localScript);
        if (!script) {
            return failure("not_found", `The script '${scriptId}' does not exist on the ioBroker server.`, "Run iobroker_upload_all_changed_scripts to create all missing scripts on the server.");
        }

        await deps.scriptRemote.uploadScript(script);
        await deps.scripts.evaluateDirtyState(localScript);
        await deps.scripts.evaluateScriptOnRemote(localScript);

        return success({ uploaded: [scriptIdOf(localScript)], failed: [] });
    } catch (error) {
        return toFailure(error);
    }
}

/** Uploads every script whose local file differs from the content on the ioBroker server. */
export async function uploadAllChangedScripts(deps: ToolDeps): Promise<ToolOutcome<UploadScriptsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const uploaded: string[] = [];
    const failed: UploadScriptsDto["failed"] = [];

    for (const localScript of deps.scripts.getAllChangedScripts()) {
        const scriptId = scriptIdOf(localScript);

        try {
            const script = await deps.scripts.getScriptWithLocalContent(localScript);
            if (!script) {
                failed.push({ scriptId: scriptId, success: false, reason: "The script does not exist on the ioBroker server." });
                continue;
            }

            await deps.scriptRemote.uploadScript(script);
            await deps.scripts.evaluateDirtyState(localScript);
            await deps.scripts.evaluateScriptOnRemote(localScript);
            uploaded.push(scriptId);
        } catch (error) {
            failed.push({ scriptId: scriptId, success: false, reason: error instanceof Error ? error.message : `${error}` });
        }
    }

    return success({ uploaded: uploaded, failed: failed });
}
