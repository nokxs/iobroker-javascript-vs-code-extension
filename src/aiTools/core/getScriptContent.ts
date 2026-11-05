import { failure, GetScriptContentDto, GetScriptContentInput, MAX_SCRIPT_CONTENT_LENGTH, success, ToolDeps, ToolOutcome } from "./types";
import { filePathOf, scriptIdOf, scriptNameOf } from "./helpers";
import { toBoundedInteger, toScriptId } from "./validation";

/** Returns the source of a script. The local file wins, the server content is the fallback. */
export async function getScriptContent(deps: ToolDeps, input: GetScriptContentInput): Promise<ToolOutcome<GetScriptContentDto>> {
    const scriptIdResult = toScriptId(input.scriptId);
    if (!scriptIdResult.ok) {
        return scriptIdResult;
    }

    const scriptId = scriptIdResult.data;
    const localScript = deps.scripts.getScriptFromId(scriptId);
    if (!localScript) {
        return failure("not_found", `The script '${scriptId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available script ids.");
    }

    const maxLength = toBoundedInteger(input.maxLength, MAX_SCRIPT_CONTENT_LENGTH, 1, Number.MAX_SAFE_INTEGER);

    let source = await deps.script.getFileContentOnDisk(localScript.absoluteUri);
    const fromDisk = source !== null;

    if (source === null) {
        source = localScript.ioBrokerScript.common.source ?? "";
    }

    const truncated = source.length > maxLength;

    return success({
        scriptId: scriptIdOf(localScript),
        name: scriptNameOf(localScript),
        filePath: filePathOf(localScript),
        source: truncated ? source.substring(0, maxLength) : source,
        fromDisk: fromDisk,
        truncated: truncated
    });
}
