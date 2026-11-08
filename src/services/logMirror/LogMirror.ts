import * as fs from "fs";
import * as path from "path";
import { ILogMessage } from "../../models/ILogMessage";

export const DEFAULT_MIRROR_RELATIVE_PATH = ".iobroker/javascript-live.log";
export const DEFAULT_MIRROR_MAX_SIZE_MB = 10;

/**
 * Resolves a configured mirror path against the workspace root.
 * Returns undefined when the path would leave the workspace (absolute or `..`),
 * or when `configured` is set to a non-string value.
 *
 * This check is lexical only. Call {@link isRealPathInsideWorkspace} before
 * creating directories or opening the file so symlinks cannot escape.
 */
export function resolveMirrorPath(workspaceRoot: string, configured: unknown): string | undefined {
    if (configured !== undefined && typeof configured !== "string") {
        return undefined;
    }

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

function tryRealpath(candidate: string): string | undefined {
    try {
        const native = (fs.realpathSync as { native?: (p: string) => string }).native;
        return native ? native(candidate) : fs.realpathSync(candidate);
    } catch {
        return undefined;
    }
}

function isPathInsideRoot(realRoot: string, candidate: string): boolean {
    const rel = path.relative(realRoot, candidate);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isSymlink(candidate: string): boolean {
    try {
        return fs.lstatSync(candidate).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Returns true when `target` (and an existing `<target>.1` rotation file) resolve
 * inside the real workspace root after following existing path components.
 * Rejects leaf symlinks so createWriteStream / copyFileSync cannot escape.
 */
export function isRealPathInsideWorkspace(workspaceRoot: string, target: string): boolean {
    const realRoot = tryRealpath(workspaceRoot);
    if (!realRoot) {
        return false;
    }

    let probe = target;
    let existing = tryRealpath(probe);
    while (!existing) {
        const parent = path.dirname(probe);
        if (parent === probe) {
            return false;
        }
        probe = parent;
        existing = tryRealpath(probe);
    }

    if (!isPathInsideRoot(realRoot, existing)) {
        return false;
    }

    if (isSymlink(target)) {
        return false;
    }

    const rotated = `${target}.1`;
    if (isSymlink(rotated)) {
        return false;
    }
    if (fs.existsSync(rotated)) {
        const realRotated = tryRealpath(rotated);
        if (!realRotated || !isPathInsideRoot(realRoot, realRotated)) {
            return false;
        }
    }

    return true;
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

/**
 * End a write stream and wait until the underlying fd is closed (flushes the buffer).
 * Keeps a permanent no-op error listener so a delayed flush error after end() cannot
 * become an unhandled 'error' event on the extension host.
 */
export function endWriteStream(stream: NodeJS.WritableStream): Promise<void> {
    return new Promise(resolve => {
        const noop = () => { /* swallow delayed errors after end() */ };
        stream.on("error", noop);

        let settled = false;
        const done = () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        };

        stream.once("close", done);
        stream.once("error", done);
        try {
            stream.end();
        } catch {
            done();
        }
    });
}
