import * as path from "path";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { ScriptId } from "../../models/ScriptId";
import { DirectoryDto, failure, ScriptSummaryDto, ToolDeps, ToolOutcome } from "./types";
import { toMessage } from "./validation";

export const ROOT_DIRECTORY_ID = "script.js";

export function scriptIdOf(script: ILocalScript): string {
    return `${script._id}`;
}

export function lastSegment(id: string): string {
    return id.substring(id.lastIndexOf(".") + 1);
}

export function scriptNameOf(script: ILocalScript): string {
    return script.ioBrokerScript.common.name ?? lastSegment(scriptIdOf(script));
}

export function filePathOf(script: ILocalScript): string {
    return script.absoluteUri.fsPath;
}

export function toScriptSummary(script: ILocalScript): ScriptSummaryDto {
    return {
        scriptId: scriptIdOf(script),
        name: scriptNameOf(script),
        filePath: filePathOf(script),
        engineType: `${script.ioBrokerScript.common.engineType ?? ""}`,
        enabled: script.ioBrokerScript.common.enabled === true,
        isDirty: script.isDirty,
        isRemoteOnly: script.isRemoteOnly
    };
}

export function toDirectoryDto(directory: IDirectory): DirectoryDto {
    const id = `${directory._id}`;
    return {
        id: id,
        name: directory.common?.name ?? id
    };
}

/** Resolves a directory id against all known directories including the root directory. */
export function findDirectory(deps: ToolDeps, directoryId: string): IDirectory | undefined {
    if (directoryId === ROOT_DIRECTORY_ID) {
        return deps.scripts.getRootDirectory();
    }

    return deps.scripts.getAllDirectories().find(d => `${d._id}` === directoryId);
}

export function allDirectories(deps: ToolDeps): IDirectory[] {
    const directories = deps.scripts.getAllDirectories().slice();
    const root = deps.scripts.getRootDirectory();

    if (!directories.some(d => `${d._id}` === `${root._id}`)) {
        directories.unshift(root);
    }

    return directories;
}

/** The file extension of the local file. Falls back to the one derived from the engine type. */
export function extensionOf(script: ILocalScript, deps: ToolDeps): string {
    const extension = path.extname(script.absoluteUri.fsPath).replace(/^\./, "");
    if (extension) {
        return extension;
    }

    return deps.script.getFileExtension(script.ioBrokerScript.common.engineType);
}

export function toFailure(error: unknown): ToolOutcome<never> {
    return failure(
        "server_error",
        toMessage(error),
        "Check the ioBroker connection and the given script id, then retry.");
}

/**
 * Mirrors the sanitization of `ScriptRemoteService.rename`, so the new id of a renamed script can
 * be predicted and looked up in the cache afterwards.
 */
export function sanitizeScriptName(name: string): string {
    return (name || "").replace(/[\\/\][*,;'"`<>?\s]/g, '_');
}

/**
 * Re-reads a single script from ioBroker into the cache. Failures are swallowed on purpose:
 * the socket based cache invalidation runs anyway and a stale cache entry is better than
 * reporting a successful write operation as failed.
 */
export async function refreshScriptInCache(deps: ToolDeps, id: ScriptId): Promise<void> {
    try {
        await deps.scripts.updateSingleScriptOrDirectoryFromServer(id);
    } catch {
        // ignored, see comment above
    }
}
