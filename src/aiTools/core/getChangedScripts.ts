import { ChangedScriptDto, GetChangedScriptsDto, GetChangedScriptsInput, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { filePathOf, scriptIdOf, scriptNameOf } from "./helpers";

/**
 * Lists the scripts whose local file differs from the ioBroker server.
 * Re-evaluating all scripts requires a connection and is therefore only done on demand.
 */
export async function getChangedScripts(deps: ToolDeps, input: GetChangedScriptsInput): Promise<ToolOutcome<GetChangedScriptsDto>> {
    if (input.refresh === true) {
        const connectionError = ensureConnected(deps);
        if (connectionError) {
            return { ok: false, error: connectionError };
        }

        await deps.scripts.evaluateDirtyStateForAllScripts();
        await deps.scripts.evaluateScriptOnRemoteForAllScripts();
    }

    const scripts = deps.scripts.getAllChangedScripts().map<ChangedScriptDto>(script => ({
        scriptId: scriptIdOf(script),
        name: scriptNameOf(script),
        filePath: filePathOf(script)
    }));

    return success({ scripts: scripts });
}
