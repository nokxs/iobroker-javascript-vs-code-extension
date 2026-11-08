/**
 * Rules about the shape of ioBroker script ids. Scripts and script directories share the same
 * namespace, only the object type (`script` vs `channel`) differs.
 *
 * Kept free of VS Code imports so that it can be used by the AI tools, the commands and the views.
 */

/** Every script id starts with this prefix. */
export const SCRIPT_ID_PREFIX = "script.js";

/** Id of the root directory that contains all scripts and script directories. */
export const ROOT_DIRECTORY_ID = SCRIPT_ID_PREFIX;

/** The last segment of an id, e.g. 'Licht' for 'script.js.common.Licht'. */
export function lastSegmentOf(id: string): string {
    return id.substring(id.lastIndexOf(".") + 1);
}

/** The parent id, e.g. 'script.js.common' for 'script.js.common.Licht'. Undefined for the root. */
export function parentIdOf(id: string): string | undefined {
    // The prefix itself contains a dot, so it has to be handled explicitly.
    if (id === ROOT_DIRECTORY_ID) {
        return undefined;
    }

    const index = id.lastIndexOf(".");
    return index <= 0 ? undefined : id.substring(0, index);
}

/**
 * True for a script id, meaning an id below the script namespace with non empty segments.
 * 'script.js' itself is the root directory and therefore not a script id.
 */
export function isScriptId(id: string): boolean {
    return id.startsWith(`${SCRIPT_ID_PREFIX}.`) && hasOnlyNonEmptySegments(id);
}

/** True for the root directory id and for every id below it. */
export function isDirectoryId(id: string): boolean {
    return id === ROOT_DIRECTORY_ID || isScriptId(id);
}

function hasOnlyNonEmptySegments(id: string): boolean {
    return !id.endsWith(".") && id.split(".").every(segment => segment.length > 0);
}
