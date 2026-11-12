import { EngineType } from "../../../models/EngineType";
import { ScriptId } from "../../../models/ScriptId";
import { CreateScriptDto, CreateScriptInput, failure, RemoteToolDeps, success, ToolOutcome } from "./types";
import { defaultScript, ensureRemoteConnected, findDirectory, refreshScriptInCache } from "./helpers";
import { toFailure } from "../helpers";
import { toDirectoryId, toMessage, validateName } from "../validation";

const KNOWN_EXTENSIONS = [".js", ".ts"];

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
    const script = defaultScript(new ScriptId(`${directory._id}.${fileName}`), engineType);
    script.common.source = source;

    if (deps.scripts.getScriptFromId(script._id)) {
        return failure("already_exists", `The script '${script._id}' does already exist on the ioBroker server.`, "Choose a different 'fileName' or delete the existing script first.");
    }

    try {
        await deps.scriptRemote.uploadScript(script);
        await refreshScriptInCache(deps, script._id);

        return success({
            scriptId: `${script._id}`,
            name: script.common.name ?? fileName,
            engineType: `${script.common.engineType ?? engineType}`
        });
    } catch (error) {
        const message = toMessage(error);
        if (message.includes("does already exist")) {
            return failure("already_exists", message, "Choose a different 'fileName' or delete the existing script first.");
        }

        return toFailure(error);
    }
}

function toEngineType(raw: unknown): ToolOutcome<EngineType> {
    if (raw === "typescript" || raw === EngineType.typescript) {
        return success(EngineType.typescript);
    }

    if (raw === "javascript" || raw === EngineType.javascript) {
        return success(EngineType.javascript);
    }

    return failure("invalid_input", "'language' must be either 'javascript' or 'typescript'.");
}

function normalizeFileName(fileName: string): string {
    let result = fileName;

    for (const extension of KNOWN_EXTENSIONS) {
        if (result.toLowerCase().endsWith(extension)) {
            result = result.substring(0, result.length - extension.length);
        }
    }

    return result.trim();
}
