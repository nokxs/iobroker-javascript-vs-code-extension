import { IDirectory } from "../../models/IDirectory";
import { ScriptId } from "../../models/ScriptId";
import { ensureConnected } from "./connection";
import { findDirectory, refreshScriptInCache, scriptIdOf } from "./helpers";
import { DeleteDirectoryDto, DeleteDirectoryInput, failure, success, ToolDeps, ToolOutcome } from "./types";
import { toDirectoryId, toMessage } from "./validation";

/**
 * Deletes an empty script directory. Only the `channel` object on the ioBroker server and the
 * matching local folder are removed; the scripts and subdirectories inside a directory are never
 * touched. Pass an empty directory, or delete or move its content first.
 */
export async function deleteDirectory(deps: ToolDeps, input: DeleteDirectoryInput): Promise<ToolOutcome<DeleteDirectoryDto>> {
    const directoryIdResult = toDirectoryId(input.directoryId);
    if (!directoryIdResult.ok) {
        return directoryIdResult;
    }

    const directoryId = directoryIdResult.data;
    if (directoryId === ScriptId.rootId) {
        return failure("invalid_input", "The root directory cannot be deleted.", "Delete or move the scripts and directories inside it instead.");
    }

    const directory = findDirectory(deps, directoryId);
    if (!directory) {
        return failure("not_found", `The directory '${directoryId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const contentError = findContentError(deps, directory, directoryId);
    if (contentError) {
        return contentError;
    }

    const folderPath = directory.absoluteUri.fsPath;
    const folderExists = deps.files.directoryExists(directory.absoluteUri);

    // The local folder is removed first. If the server call fails afterwards, the tool can simply
    // be retried: an already missing folder passes the empty check and the channel is removed then.
    if (folderExists) {
        try {
            await deps.files.deleteDirectory(directory.absoluteUri);
        } catch (error) {
            return {
                ok: false,
                error: {
                    code: "server_error",
                    message: `The folder '${folderPath}' could not be deleted: ${toMessage(error)}`,
                    hint: "Close the files in the folder and check the permissions of the workspace folder, then retry."
                }
            };
        }
    }

    try {
        await deps.directories.deleteDirectory(new ScriptId(directoryId));
    } catch (error) {
        return {
            ok: false,
            error: {
                code: "server_error",
                message: `The local folder was deleted, but the directory '${directoryId}' could not be removed from the ioBroker server: ${toMessage(error)}`,
                hint: "Check the ioBroker connection and the permissions of the configured user, then retry."
            }
        };
    }

    await refreshScriptInCache(deps, new ScriptId(directoryId));

    return success({
        directoryId: directoryId,
        deletedFolderPath: folderExists ? folderPath : null
    });
}

/** Answers why the directory may not be deleted, or `undefined` when it is empty. */
function findContentError(deps: ToolDeps, directory: IDirectory, directoryId: string): ToolOutcome<never> | undefined {
    const prefix = `${directoryId}.`.toLowerCase();

    const containedScripts = deps.scripts.getAllScripts()
        .filter(script => scriptIdOf(script).toLowerCase().startsWith(prefix));

    if (containedScripts.length > 0) {
        const ids = containedScripts.slice(0, 5).map(scriptIdOf).join(", ");
        return failure("invalid_input", `The directory '${directoryId}' is not empty, it still contains the scripts ${ids}.`, "Delete or move the scripts first, then retry. Use iobroker_get_scripts to list them.");
    }

    const containedDirectories = deps.scripts.getAllDirectories()
        .filter(dir => `${dir._id}`.toLowerCase().startsWith(prefix));

    if (containedDirectories.length > 0) {
        const ids = containedDirectories.slice(0, 5).map(dir => `${dir._id}`).join(", ");
        return failure("invalid_input", `The directory '${directoryId}' is not empty, it still contains the directories ${ids}.`, "Delete or move the subdirectories first, then retry. Use iobroker_get_scripts to list them.");
    }

    // A folder on disk may also contain files that are not mapped to a script, for example a stray
    // file or a folder that only exists locally. Those are not in the cache.
    if (deps.files.directoryExists(directory.absoluteUri) && !deps.files.isEmptyDirectory(directory.absoluteUri)) {
        return failure("invalid_input", `The folder '${directory.absoluteUri.fsPath}' is not empty.`, "Delete or move the remaining files on disk first, then retry.");
    }

    return undefined;
}
