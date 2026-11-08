import { EngineType } from "../../models/EngineType";
import { ROOT_DIRECTORY_ID } from "../../models/ScriptIdPath";
import { CreateScriptDto, CreateScriptInput, failure, success, ToolDeps, ToolOutcome } from "./types";
import { ensureConnected } from "./connection";
import { findDirectory, refreshScriptInCache, toFailure } from "./helpers";
import { toDirectoryId, toMessage, validateName } from "./validation";

const KNOWN_EXTENSIONS = [".js", ".ts"];

/**
 * Creates a script on the ioBroker server and the matching local file. The same source is written
 * to both places so the new script is not reported as changed right away.
 */
export async function createScript(deps: ToolDeps, input: CreateScriptInput): Promise<ToolOutcome<CreateScriptDto>> {
    const nameResult = validateName(input.fileName, "fileName");
    if (!nameResult.ok) {
        return nameResult;
    }

    const languageResult = toEngineType(input.language);
    if (!languageResult.ok) {
        return languageResult;
    }

    const engineType = languageResult.data;
    const fileExtension = engineType === EngineType.typescript ? "ts" : "js";
    const fileName = normalizeFileName(nameResult.data);

    if (fileName.length === 0) {
        return failure("invalid_input", "'fileName' must contain more than the file extension.");
    }

    let directoryId = ROOT_DIRECTORY_ID;
    if (input.directoryId !== undefined) {
        const directoryIdResult = toDirectoryId(input.directoryId);
        if (!directoryIdResult.ok) {
            return directoryIdResult;
        }

        directoryId = directoryIdResult.data;
    }

    const directory = findDirectory(deps, directoryId);
    if (!directory) {
        return failure("not_found", `The directory '${directoryId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const source = typeof input.source === "string" ? input.source : "";

    try {
        const script = await deps.scriptCreation.createFileWithName(directory, fileName, `.${fileExtension}`, engineType, source);
        await refreshScriptInCache(deps, script._id);

        const fileNameWithExtension = `${fileName}.${fileExtension}`;
        const fileUri = deps.files.getFileUri(directory, fileName, `.${fileExtension}`);

        return success({
            scriptId: `${script._id}`,
            name: script.common.name ?? fileNameWithExtension,
            filePath: fileUri.fsPath,
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
