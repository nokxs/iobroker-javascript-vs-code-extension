import { IDirectory } from "../../models/IDirectory";
import { ScriptId } from "../../models/ScriptId";
import { ensureConnected } from "./connection";
import { findDirectory, refreshScriptInCache, toFailure } from "./helpers";
import { CreateDirectoryDto, CreateDirectoryInput, failure, success, ToolDeps, ToolOutcome } from "./types";
import { toDirectoryId, toMessage, validateName } from "./validation";

interface DirectoryTarget {
    parentId: string
    targetId: string
    name: string
    requireKnownParent: boolean
}

interface KnownAncestor {
    id: string
    directory: IDirectory
}

interface ExistingDirectories {
    directoryIds: string[]
    conflictingIds: string[]
}

interface LocalFolder {
    id: string
    uri: IDirectory["absoluteUri"]
}

/**
 * Creates a directory (an ioBroker `channel` of the script namespace) on the server and the
 * matching local folder. Missing intermediate directories are created as well, so a script can be
 * moved into a freshly created folder in one step.
 */
export async function createDirectory(deps: ToolDeps, input: CreateDirectoryInput): Promise<ToolOutcome<CreateDirectoryDto>> {
    const targetResult = resolveTarget(input);
    if (!targetResult.ok) {
        return targetResult;
    }

    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const target = targetResult.data;
    const knownParent = target.requireKnownParent ? findDirectory(deps, target.parentId) : undefined;
    if (target.requireKnownParent && !knownParent) {
        return failure("not_found", `The parent directory '${target.parentId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available directory ids, or pass the full id of the new directory as 'directoryId' without 'name' to create missing parents.");
    }

    const ancestor = knownParent
        ? { id: target.parentId, directory: knownParent }
        : findDeepestKnownAncestor(deps, target.parentId);
    if (!ancestor) {
        return failure("not_found", `The parent directory '${target.parentId}' is not known to the extension.`, "Use iobroker_get_scripts to look up available directory ids.");
    }

    const localUris = mapLocalUris(deps, ancestor, target.targetId);
    if (localUris.length === 0) {
        return failure("invalid_input", `'${target.targetId}' is not located below the known directory '${ancestor.id}'.`);
    }

    let existingIds: ExistingDirectories;
    try {
        existingIds = await findExistingDirectories(deps, localUris.map(entry => entry.id));
    } catch (error) {
        return toFailure(error);
    }

    if (existingIds.conflictingIds.length > 0) {
        return failure("invalid_input", `'${existingIds.conflictingIds[0]}' does already exist on the ioBroker server but is not a directory.`, "Choose a different name or move the existing script first.");
    }

    if (existingIds.directoryIds.includes(target.targetId)) {
        return failure("invalid_input", `The directory '${target.targetId}' does already exist on the ioBroker server.`, "Choose a different name or use iobroker_move_script to move an existing script.");
    }

    const targetUri = localUris[localUris.length - 1].uri;
    if (deps.files.directoryExists(targetUri)) {
        return failure("invalid_input", `The folder '${targetUri.fsPath}' does already exist on disk.`, "Choose a different name or delete the folder first.");
    }

    // Only the ids that are missing on the server are rolled back on failure. Existing directories
    // (for example 'script.js.global') are never touched.
    const createdIds = localUris.map(entry => entry.id).filter(id => !existingIds.directoryIds.includes(id));

    try {
        await deps.directories.createDirectoriesRecursively(new ScriptId(target.targetId));
    } catch (error) {
        await deleteDirectories(deps, createdIds);
        return {
            ok: false,
            error: {
                code: "server_error",
                message: `Could not create the directory '${target.targetId}': ${toMessage(error)}`,
                hint: "Check the ioBroker connection and the permissions of the configured user, then retry."
            }
        };
    }

    const createdFolders: LocalFolder[] = [];
    try {
        for (const entry of localUris) {
            if (deps.files.directoryExists(entry.uri)) {
                continue;
            }

            await deps.files.createDirectory(entry.uri);
            createdFolders.push(entry);
        }
    } catch (error) {
        // The server directories and the local folders created so far are rolled back, so the tool
        // can simply be retried after the disk problem is solved.
        await deleteLocalFolders(deps, createdFolders);
        await deleteDirectories(deps, createdIds);
        return {
            ok: false,
            error: {
                code: "server_error",
                message: `The directory '${target.targetId}' was created on the ioBroker server, but the local folder '${targetUri.fsPath}' could not be created: ${toMessage(error)}. The changes were rolled back.`,
                hint: "Check the permissions of the workspace folder and retry."
            }
        };
    }

    await refreshScriptInCache(deps, new ScriptId(target.targetId));

    return success({
        directoryId: target.targetId,
        name: target.name,
        path: targetUri.fsPath
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

/** Walks up the id until a directory that is known to the extension is found. */
function findDeepestKnownAncestor(deps: ToolDeps, directoryId: string): KnownAncestor | undefined {
    const directory = findDirectory(deps, directoryId);
    if (directory) {
        return { id: directoryId, directory: directory };
    }

    const parentId = ScriptId.parentIdOf(directoryId);
    return parentId === undefined ? undefined : findDeepestKnownAncestor(deps, parentId);
}

/** All directory ids between the known ancestor (exclusive) and the target (inclusive). */
function idsBelow(ancestorId: string, targetId: string): string[] {
    const targetParts = targetId.split(".");
    const ancestorPartCount = ancestorId.split(".").length;
    const result: string[] = [];

    for (let count = ancestorPartCount + 1; count <= targetParts.length; count++) {
        result.push(targetParts.slice(0, count).join("."));
    }

    return result;
}

/**
 * Maps every new directory id to the local folder. Known directories use their cached absolute
 * uri, missing ones are appended to the uri of the previous segment.
 */
function mapLocalUris(deps: ToolDeps, ancestor: KnownAncestor, targetId: string): LocalFolder[] {
    const ids = idsBelow(ancestor.id, targetId);
    const result: LocalFolder[] = [];

    let currentUri = ancestor.directory.absoluteUri;
    for (const id of ids) {
        const known = findDirectory(deps, id);
        const uri = known ? known.absoluteUri : deps.files.getDirectoryUri(currentUri, ScriptId.lastSegmentOf(id));

        result.push({ id: id, uri: uri });
        currentUri = uri;
    }

    return result;
}

/** Answers which of the given ids already exist on the server. The cache is consulted first. */
async function findExistingDirectories(deps: ToolDeps, ids: string[]): Promise<ExistingDirectories> {
    const directoryIds: string[] = [];
    const conflictingIds: string[] = [];

    for (const id of ids) {
        if (findDirectory(deps, id)) {
            directoryIds.push(id);
            continue;
        }

        const existing = await deps.directories.downloadDirectory(new ScriptId(id));
        if (!existing) {
            continue;
        }

        if (isDirectoryObject(existing)) {
            directoryIds.push(id);
        } else {
            conflictingIds.push(id);
        }
    }

    return { directoryIds: directoryIds, conflictingIds: conflictingIds };
}

function isDirectoryObject(value: IDirectory): boolean {
    const type = (value as unknown as { type?: string }).type;
    return type === undefined || type === "channel";
}

/** Best effort rollback. A failed deletion must not hide the original error. */
async function deleteDirectories(deps: ToolDeps, ids: string[]): Promise<void> {
    for (const id of ids.slice().reverse()) {
        try {
            await deps.directories.deleteDirectory(new ScriptId(id));
        } catch {
            // ignored, see comment above
        }
    }
}

/** Best effort rollback of the local folders that were created before a later folder failed. */
async function deleteLocalFolders(deps: ToolDeps, folders: LocalFolder[]): Promise<void> {
    for (const folder of folders.slice().reverse()) {
        try {
            await deps.files.deleteDirectory(folder.uri);
        } catch {
            // ignored, see comment above
        }
    }
}
