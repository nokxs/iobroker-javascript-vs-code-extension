import { EngineType, getEngineTypeInfo } from "../../../models/EngineType";
import { IScript } from "../../../models/IScript";
import { ScriptId } from "../../../models/ScriptId";
import type { RemoteDirectory } from "../../../services/remote/RemoteScriptRepository";
import { ensureConnected } from "../connection";
import type { ToolError } from "../types";
import type { DirectoryDto, RemoteToolDeps, ScriptSummaryDto } from "./types";

/** The extension points the user to a VS Code command; the server has only environment variables. */
export const REMOTE_CONNECTION_HINT =
    "Check IOBROKER_MCP_URL, IOBROKER_MCP_USERNAME and IOBROKER_MCP_PASSWORD, then retry.";

/** Used only when the server reports no javascript instance at all. */
const FALLBACK_JS_ENGINE = "system.adapter.javascript.0";

export function ensureRemoteConnected(deps: RemoteToolDeps): ToolError | undefined {
    return ensureConnected(deps, REMOTE_CONNECTION_HINT);
}

export function scriptIdOf(script: IScript): string {
    return `${script._id}`;
}

export function scriptNameOf(script: IScript): string {
    return script.common.name ?? ScriptId.lastSegmentOf(scriptIdOf(script));
}

export function toScriptSummary(script: IScript): ScriptSummaryDto {
    return {
        scriptId: scriptIdOf(script),
        name: scriptNameOf(script),
        engineType: `${script.common.engineType ?? ""}`,
        enabled: script.common.enabled === true
    };
}

export function toDirectoryDto(directory: RemoteDirectory): DirectoryDto {
    const id = `${directory._id}`;
    return {
        id: id,
        name: directory.common?.name ?? id
    };
}

/** Resolves a directory id against the cached directories including the root directory. */
export function findDirectory(deps: RemoteToolDeps, directoryId: string): RemoteDirectory | undefined {
    if (directoryId === ScriptId.rootId) {
        return deps.scripts.getRootDirectory();
    }

    return deps.scripts.getAllDirectories().find(directory => `${directory._id}` === directoryId);
}

export function allDirectories(deps: RemoteToolDeps): RemoteDirectory[] {
    const directories = deps.scripts.getAllDirectories().slice();
    const root = deps.scripts.getRootDirectory();

    if (!directories.some(directory => `${directory._id}` === `${root._id}`)) {
        directories.unshift(root);
    }

    return directories;
}

/** The remote counterpart of `ScriptService.getFileExtension`, without a local file. */
export function fileExtensionOf(engineType: string | undefined): string {
    return getEngineTypeInfo(engineType)?.fileExtension ?? "txt";
}

/**
 * The remote counterpart of `ScriptService.getDefaultScript`. The extension's member needs a
 * `ScriptIdService`, whose implementation is VS Code bound, so the server builds the object here.
 */
export function defaultScript(id: ScriptId, engineType: EngineType, engine: string | undefined): IScript {
    const sanitizedId = ScriptId.sanitizeId(id);

    return {
        _id: sanitizedId,
        common: {
            engine: engine ?? FALLBACK_JS_ENGINE,
            engineType: engineType,
            name: ScriptId.lastSegmentOf(`${sanitizedId}`),
            source: "",
            debug: false,
            verbose: false,
            enabled: false,
            expert: true
        },
        type: "script"
    };
}

/**
 * The engine of a new script: the first javascript instance the server reports, so a script is not
 * pinned to `javascript.0` on an installation that runs another instance only.
 */
export async function firstJsInstanceId(deps: RemoteToolDeps): Promise<string | undefined> {
    try {
        const instances = await deps.jsInstances.getAvailableInstances();
        return instances[0]?._id;
    } catch {
        // The upload fails on its own if the socket is broken; the fallback engine is still valid.
        return undefined;
    }
}

/** Best effort cache refresh, mirroring the extension helper. */
export async function refreshScriptInCache(deps: RemoteToolDeps, id: ScriptId): Promise<void> {
    try {
        await deps.scripts.updateSingleScriptOrDirectoryFromServer(id);
    } catch {
        // The socket invalidation runs anyway, and a stale entry is better than a failed write.
    }
}
