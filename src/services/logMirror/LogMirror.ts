import * as path from "path";
import { ILogMessage } from "../../models/ILogMessage";

export const DEFAULT_MIRROR_RELATIVE_PATH = ".iobroker/javascript-live.log";
export const DEFAULT_MIRROR_MAX_SIZE_MB = 10;

/**
 * Resolves a configured mirror path against the workspace root.
 * Returns undefined when the path would leave the workspace (absolute or `..`).
 */
export function resolveMirrorPath(workspaceRoot: string, configured: unknown): string | undefined {
    const relative = typeof configured === "string" && configured.trim() !== ""
        ? configured.trim()
        : DEFAULT_MIRROR_RELATIVE_PATH;

    if (path.isAbsolute(relative)) {
        return undefined;
    }

    const target = path.resolve(workspaceRoot, relative);
    const relToRoot = path.relative(workspaceRoot, target);
    if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
        return undefined;
    }

    return target;
}

/** One ISO timestamp (from `message.ts` when available) plus severity and message. */
export function formatMirrorLine(message: ILogMessage, nowMs: number = Date.now()): string {
    const ts = typeof message.ts === "number" && Number.isFinite(message.ts) && message.ts > 0
        ? message.ts
        : nowMs;
    return `${new Date(ts).toISOString()} ${message.severity}: ${message.message}`;
}

export function shouldRotate(currentSizeBytes: number, maxSizeMb: number): boolean {
    if (!Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
        return false;
    }
    return currentSizeBytes >= maxSizeMb * 1024 * 1024;
}

export function normalizeMaxSizeMb(raw: unknown): number {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return DEFAULT_MIRROR_MAX_SIZE_MB;
}
