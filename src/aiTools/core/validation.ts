import { ScriptId } from "../../models/ScriptId";
import { failure, success, ToolOutcome } from "./types";

const INVALID_NAME_CHARACTERS = /[\\/:*?"<>|]/;
const MAX_NAME_LENGTH = 120;

/**
 * Validates a user supplied file/script name. The name ends up in a file system path, so path
 * separators and traversal must be rejected here.
 */
export function validateName(raw: unknown, field: string): ToolOutcome<string> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return failure("invalid_input", `'${field}' must be a non empty string.`);
    }

    const name = raw.trim();

    if (name.length > MAX_NAME_LENGTH) {
        return failure("invalid_input", `'${field}' must not be longer than ${MAX_NAME_LENGTH} characters.`);
    }

    if (INVALID_NAME_CHARACTERS.test(name) || name.includes("..")) {
        return failure("invalid_input", `'${field}' must not contain path separators or any of \\ / : * ? " < > |.`, "Use a plain file name like 'MyScript'.");
    }

    if (name.startsWith(".") || name.endsWith(".") || name.endsWith(" ")) {
        return failure("invalid_input", `'${field}' must not start with a dot and must not end with a dot or a space.`);
    }

    return success(name);
}

/** Validates a script id. The id has to use the ioBroker script namespace. */
export function toScriptId(raw: unknown, field = "scriptId"): ToolOutcome<ScriptId> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return failure("invalid_input", `'${field}' must be a non empty string.`, "Use iobroker_get_scripts to look up script ids.");
    }

    const id = raw.trim();
    if (!id.startsWith("script.js.") || id.length <= "script.js.".length) {
        return failure("invalid_input", `'${field}' must be a full ioBroker script id starting with 'script.js.', but was '${id}'.`, "Use iobroker_get_scripts to look up script ids.");
    }

    try {
        return success(new ScriptId(id));
    } catch (error) {
        return failure("invalid_input", `'${field}' is not a valid script id: ${toMessage(error)}`);
    }
}

/** Validates a directory id. The root directory is a valid target and has the id 'script.js'. */
export function toDirectoryId(raw: unknown, field = "directoryId"): ToolOutcome<string> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return failure("invalid_input", `'${field}' must be a non empty string.`, "Use iobroker_get_scripts to look up directory ids.");
    }

    const id = raw.trim();
    if (!id.startsWith("script.js")) {
        return failure("invalid_input", `'${field}' must be a directory id starting with 'script.js', but was '${id}'.`, "Use iobroker_get_scripts to look up directory ids.");
    }

    return success(id);
}

export function toBoundedInteger(raw: unknown, fallback: number, min: number, max: number): number {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(raw)));
}

export function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : `${error}`;
}
