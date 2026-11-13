import { IScript } from "../../../models/IScript";
import { ScriptId } from "../../../models/ScriptId";
import { CreateScriptDto, CreateScriptInput, failure, RemoteToolDeps, success, ToolOutcome } from "./types";
import { defaultScript, ensureRemoteConnected, findDirectory, refreshScriptInCache, firstJsInstanceId } from "./helpers";
import { toFailure } from "../helpers";
import { toDirectoryId, validateName } from "../validation";
import { normalizeFileName, toEngineType } from "../scriptNaming";

/**
 * Creates a script on the ioBroker server. The source starts in the server object, because the
 * server has no local file to write.
 */
export async function createScript(deps: RemoteToolDeps, input: CreateScriptInput): Promise<ToolOutcome<CreateScriptDto>> {
    const nameResult = validateName(input.fileName, "fileName");
    if (!nameResult.ok) {
        return nameResult;
    }

    const languageResult = toEngineType(input.language);
    if (!languageResult.ok) {
        return languageResult;
    }

    const engineType = languageResult.data;
    const fileName = normalizeFileName(nameResult.data);

    if (fileName.length === 0) {
        return failure("invalid_input", "'fileName' must contain more than the file extension.");
    }

    let directoryId = ScriptId.rootId;
    if (input.directoryId !== undefined) {
        const directoryIdResult = toDirectoryId(input.directoryId);
        if (!directoryIdResult.ok) {
            return directoryIdResult;
        }

        directoryId = directoryIdResult.data;
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const directory = findDirectory(deps, directoryId);
    if (!directory) {
        return failure("not_found", `The directory '${directoryId}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const source = typeof input.source === "string" ? input.source : "";
    const script = defaultScript(
        new ScriptId(`${directory._id}.${fileName}`),
        engineType,
        await firstJsInstanceId(deps));

    // The cache can be stale, so the server is asked before it is overwritten by `setObject`.
    let existing: IScript | null;
    try {
        existing = await deps.scriptRemote.downloadScriptWithId(script._id);
    } catch (error) {
        return toFailure(error);
    }

    if (existing) {
        return failure("already_exists", `The id '${script._id}' does already exist on the ioBroker server.`, "Choose a different 'fileName' or delete the existing script first.");
    }

    script.common.source = source;

    try {
        await deps.scriptRemote.uploadScript(script);
        await refreshScriptInCache(deps, script._id);

        return success({
            scriptId: `${script._id}`,
            name: script.common.name ?? fileName,
            engineType: `${script.common.engineType ?? engineType}`
        });
    } catch (error) {
        return toFailure(error);
    }
}
