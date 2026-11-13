import { ScriptId } from "../../models/ScriptId";
import { CreateDirectoryInput, failure, success, ToolOutcome } from "./types";
import { toDirectoryId, validateName } from "./validation";

export interface DirectoryTarget {
    parentId: string
    targetId: string
    name: string
    /** True when the id came from a parent id plus a name, so the parent has to be known. */
    requireKnownParent: boolean
}

/**
 * Resolves the `directoryId`/`name` pair of `iobroker_create_directory`. Shared by the extension
 * and the MCP server: both create the same ioBroker `channel` and only differ in the local folder.
 */
export function resolveDirectoryTarget(input: CreateDirectoryInput): ToolOutcome<DirectoryTarget> {
    const directoryIdResult = toDirectoryId(input.directoryId);
    if (!directoryIdResult.ok) {
        return directoryIdResult;
    }

    const rawId = directoryIdResult.data;
    // A given name always means that the id is the parent. A blank name is rejected by
    // `validateName` instead of being silently treated as "no name".
    const hasName = input.name !== undefined;

    let parentId: string;
    let name: string;

    if (hasName) {
        const nameResult = validateName(input.name, "name");
        if (!nameResult.ok) {
            return nameResult;
        }

        parentId = rawId;
        name = nameResult.data;
    } else {
        // Without a name the id is the full id of the new directory, for example
        // 'script.js.global.07-late-dependencies.devices'.
        if (rawId === ScriptId.rootId) {
            return failure("invalid_input", "'directoryId' must be a directory below 'script.js' when 'name' is omitted.", "Pass the parent directory id as 'directoryId' and the new name as 'name'.");
        }

        const parentIdOfRawId = ScriptId.parentIdOf(rawId);
        if (parentIdOfRawId === undefined) {
            return failure("invalid_input", `'${rawId}' has no parent directory.`);
        }

        parentId = parentIdOfRawId;
        name = ScriptId.lastSegmentOf(rawId);

        const nameResult = validateName(name, "name");
        if (!nameResult.ok) {
            return nameResult;
        }
    }

    if (!ScriptId.isDirectoryId(parentId)) {
        return failure("invalid_input", `'${parentId}' is not a valid parent directory id.`, "Use 'script.js' for the root directory or a full id like 'script.js.common'.");
    }

    if (name.includes(".")) {
        return failure("invalid_input", "'name' must not contain dots, because dots separate ioBroker ids.", "Use a plain directory name like 'MyFolder'.");
    }

    const targetId = `${parentId}.${name}`;
    if (!ScriptId.isDirectoryId(targetId)) {
        return failure("invalid_input", `'${targetId}' is not a valid directory id.`);
    }

    return success({ parentId: parentId, targetId: targetId, name: name, requireKnownParent: hasName });
}
