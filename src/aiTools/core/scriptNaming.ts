import { EngineType } from "../../models/EngineType";
import { failure, success, ToolOutcome } from "./types";

const KNOWN_EXTENSIONS = [".js", ".ts"];

/**
 * Parses the `language` input of `iobroker_create_script`. Shared by the extension and the MCP
 * server, so both accept the same values and derive the same engine type.
 */
export function toEngineType(raw: unknown): ToolOutcome<EngineType> {
    if (raw === "typescript" || raw === EngineType.typescript) {
        return success(EngineType.typescript);
    }

    if (raw === "javascript" || raw === EngineType.javascript) {
        return success(EngineType.javascript);
    }

    return failure("invalid_input", "'language' must be either 'javascript' or 'typescript'.");
}

/** Strips a trailing '.js'/'.ts' from the file name, because the engine type decides the extension. */
export function normalizeFileName(fileName: string): string {
    let result = fileName;

    for (const extension of KNOWN_EXTENSIONS) {
        if (result.toLowerCase().endsWith(extension)) {
            result = result.substring(0, result.length - extension.length);
        }
    }

    return result.trim();
}
