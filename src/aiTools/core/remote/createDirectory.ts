import { ScriptId } from "../../../models/ScriptId";
import {
    CreateDirectoryDto,
    CreateDirectoryInput,
    failure,
    RemoteToolDeps,
    success,
    ToolOutcome
} from "./types";
import { ensureRemoteConnected, findDirectory, refreshScriptInCache } from "./helpers";
import { toDirectoryId, toMessage, validateName } from "../validation";

interface DirectoryTarget {
    parentId: string
    targetId: string
    name: string
    requireKnownParent: boolean
}

/**
 * Creates a directory (an ioBroker `channel` of the script namespace) on the server. Missing
 * intermediate directories are created as well; there is no local folder to mirror.
 */
export async function createDirectory(deps: RemoteToolDeps, input: CreateDirectoryInput): Promise<ToolOutcome<CreateDirectoryDto>> {
    const targetResult = resolveTarget(input);
    if (!targetResult.ok) {
        return targetResult;
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const target = targetResult.data;
    if (target.requireKnownParent && !findDirectory(deps, target.parentId)) {
        return failure("not_found", `The parent directory '${target.parentId}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available directory ids, or pass the full id of the new directory as 'directoryId' without 'name' to create missing parents.");
    }

    if (findDirectory(deps, target.targetId)) {
        return failure("invalid_input", `The directory '${target.targetId}' does already exist on the ioBroker server.`, "Choose a different name or use iobroker_move_script to move an existing script.");
    }

    if (ScriptId.isValid(target.targetId) && deps.scripts.getScriptFromId(new ScriptId(target.targetId))) {
        return failure("invalid_input", `'${target.targetId}' does already exist on the ioBroker server but is not a directory.`, "Choose a different name or move the existing script first.");
    }

    try {
        await deps.directories.createDirectoriesRecursively(new ScriptId(target.targetId));
    } catch (error) {
        return {
            ok: false,
            error: {
                code: "server_error",
                message: `Could not create the directory '${target.targetId}': ${toMessage(error)}`,
                hint: "Check the ioBroker connection and the permissions of the configured user, then retry."
            }
        };
    }

    await refreshScriptInCache(deps, new ScriptId(target.targetId));

    return success({
        directoryId: target.targetId,
        name: target.name
    });
}

function resolveTarget(input: CreateDirectoryInput): ToolOutcome<DirectoryTarget> {
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
