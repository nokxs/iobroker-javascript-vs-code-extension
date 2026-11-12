import { DeleteDirectoryDto, DeleteDirectoryInput, failure, RemoteToolDeps, success, ToolOutcome } from "./types";
import { ensureRemoteConnected, findDirectory, refreshScriptInCache, scriptIdOf } from "./helpers";
import { ScriptId } from "../../../models/ScriptId";
import CONSTANTS from "../../../Constants";
import { toDirectoryId, toMessage } from "../validation";

/**
 * Deletes an empty script directory. Only the `channel` object on the ioBroker server is removed;
 * the scripts and subdirectories inside a directory are never touched.
 */
export async function deleteDirectory(deps: RemoteToolDeps, input: DeleteDirectoryInput): Promise<ToolOutcome<DeleteDirectoryDto>> {
    const directoryIdResult = toDirectoryId(input.directoryId);
    if (!directoryIdResult.ok) {
        return directoryIdResult;
    }

    const directoryId = directoryIdResult.data;
    if (directoryId === ScriptId.rootId) {
        return failure("invalid_input", "The root directory cannot be deleted.", "Delete or move the scripts and directories inside it instead.");
    }

    // The same rule as in the tree view command: ioBroker needs these two directories.
    if (directoryId === CONSTANTS.skriptIds.common || directoryId === CONSTANTS.skriptIds.global) {
        return failure("invalid_input", `The directory '${directoryId}' is needed by ioBroker and cannot be deleted.`, "Delete or move the scripts and directories inside it instead.");
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const directory = findDirectory(deps, directoryId);
    if (!directory) {
        return failure("not_found", `The directory '${directoryId}' is not known to the ioBroker server.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const contentError = findContentError(deps, directoryId);
    if (contentError) {
        return contentError;
    }

    try {
        await deps.directories.deleteDirectory(new ScriptId(directoryId));
    } catch (error) {
        return {
            ok: false,
            error: {
                code: "server_error",
                message: `Could not remove the directory '${directoryId}' from the ioBroker server: ${toMessage(error)}`,
                hint: "Check the ioBroker connection and the permissions of the configured user, then retry."
            }
        };
    }

    await refreshScriptInCache(deps, new ScriptId(directoryId));

    return success({ directoryId: directoryId });
}

/** Answers why the directory may not be deleted, or `undefined` when it is empty. */
function findContentError(deps: RemoteToolDeps, directoryId: string): ToolOutcome<never> | undefined {
    const prefix = `${directoryId}.`.toLowerCase();

    const containedScripts = deps.scripts.getAllScripts()
        .filter(script => scriptIdOf(script).toLowerCase().startsWith(prefix));

    if (containedScripts.length > 0) {
        const ids = containedScripts.slice(0, 5).map(scriptIdOf).join(", ");
        return failure("invalid_input", `The directory '${directoryId}' is not empty, it still contains the scripts ${ids}.`, "Delete or move the scripts first, then retry. Use iobroker_get_scripts to list them.");
    }

    const containedDirectories = deps.scripts.getAllDirectories()
        .filter(directory => `${directory._id}`.toLowerCase().startsWith(prefix));

    if (containedDirectories.length > 0) {
        const ids = containedDirectories.slice(0, 5).map(directory => `${directory._id}`).join(", ");
        return failure("invalid_input", `The directory '${directoryId}' is not empty, it still contains the directories ${ids}.`, "Delete or move the subdirectories first, then retry. Use iobroker_get_scripts to list them.");
    }

    return undefined;
}
