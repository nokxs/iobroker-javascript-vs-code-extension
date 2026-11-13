import { ScriptId } from "../../../models/ScriptId";
import { resolveDirectoryTarget } from "../directoryTarget";
import {
    CreateDirectoryDto,
    CreateDirectoryInput,
    failure,
    RemoteToolDeps,
    success,
    ToolOutcome
} from "./types";
import { ensureRemoteConnected, findDirectory, refreshScriptInCache } from "./helpers";
import { toMessage } from "../validation";

/**
 * Creates a directory (an ioBroker `channel` of the script namespace) on the server. Missing
 * intermediate directories are created as well; there is no local folder to mirror.
 */
export async function createDirectory(deps: RemoteToolDeps, input: CreateDirectoryInput): Promise<ToolOutcome<CreateDirectoryDto>> {
    const targetResult = resolveDirectoryTarget(input);
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

    // Only ids that are missing in the cache are candidates for the rollback below.
    const possiblyCreated = missingDirectoryIds(deps, target.targetId);

    try {
        await deps.directories.createDirectoriesRecursively(new ScriptId(target.targetId));
    } catch (error) {
        await rollbackCreatedDirectories(deps, possiblyCreated);
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

/** The ids between the deepest known directory and the target, shallow to deep. */
function missingDirectoryIds(deps: RemoteToolDeps, targetId: string): string[] {
    const ids: string[] = [];
    let current: string | undefined = targetId;

    while (current !== undefined && !findDirectory(deps, current)) {
        ids.push(current);
        current = ScriptId.parentIdOf(current);
    }

    return ids.reverse();
}

/**
 * Best effort rollback of the directories a failed creation may have left behind. Only a directory
 * that exists on the server, was not known before, and has no content is removed, so a directory
 * that appeared in the meantime is never deleted. The walk stops at the first failure: deleting a
 * parent while a child survived would leave an orphaned directory behind.
 */
async function rollbackCreatedDirectories(deps: RemoteToolDeps, ids: string[]): Promise<void> {
    for (const id of ids.slice().reverse()) {
        try {
            if (hasContent(deps, id)) {
                return;
            }

            const existing = await deps.directories.downloadDirectory(new ScriptId(id));
            if (!existing) {
                continue;
            }

            await deps.directories.deleteDirectory(new ScriptId(id));
        } catch {
            // A failed rollback must not hide the original error.
            return;
        }
    }
}

function hasContent(deps: RemoteToolDeps, directoryId: string): boolean {
    const prefix = `${directoryId}.`.toLowerCase();

    return deps.scripts.getAllScripts().some(script => `${script._id}`.toLowerCase().startsWith(prefix)) ||
        deps.scripts.getAllDirectories().some(directory => `${directory._id}`.toLowerCase().startsWith(prefix));
}
