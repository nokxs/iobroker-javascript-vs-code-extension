/**
 * Id of a script or of a script directory. Scripts and directories share the id namespace
 * `script.js`, only the ioBroker object type (`script` vs `channel`) differs.
 *
 * The rules for the id shape live next to the type as static members, so that the AI tools, the
 * services and the views all validate ids with the same implementation.
 */
export class ScriptId extends String {
    /** Prefix of every script id. The prefix itself is the root directory, not a script. */
    static readonly prefix = "script.js";

    /**
     * Mirrors the sanitization of the ioBroker admin rename dialog: characters that would break
     * an ioBroker id are replaced by an underscore. Lives here so that the remote core does not
     * have to construct the VS Code bound `ScriptIdService`.
     */
    static sanitizeId(id: ScriptId): ScriptId {
        return new ScriptId(`${id}`.replace(/[\\/\][*,;'"`<>?&#\s]/g, "_"));
    }

    /** Id of the root directory that contains all scripts and script directories. */
    static readonly rootId = ScriptId.prefix;

    /** True for an id below the script namespace with non empty segments. */
    static isValid(id: string): boolean {
        return id.startsWith(`${ScriptId.prefix}.`) && ScriptId.hasOnlyNonEmptySegments(id);
    }

    /** True for the root directory id and for every id below it. */
    static isDirectoryId(id: string): boolean {
        return id === ScriptId.rootId || ScriptId.isValid(id);
    }

    /** The last segment, e.g. 'Licht' for 'script.js.common.Licht'. */
    static lastSegmentOf(id: string): string {
        return id.substring(id.lastIndexOf(".") + 1);
    }

    /** The parent id, e.g. 'script.js.common' for 'script.js.common.Licht'. Undefined for the root. */
    static parentIdOf(id: string): string | undefined {
        // The prefix itself contains a dot, so the root has to be handled explicitly.
        if (id === ScriptId.rootId) {
            return undefined;
        }

        const index = id.lastIndexOf(".");
        return index <= 0 ? undefined : id.substring(0, index);
    }

    constructor(s: string) {
        if (!ScriptId.isValid(s)) {
            throw new Error(`The script id '${s}' does not start with '${ScriptId.prefix}.' or contains an empty segment.`);
        }

        super(s);
    }

    private static hasOnlyNonEmptySegments(id: string): boolean {
        return !id.endsWith(".") && id.split(".").every(segment => segment.length > 0);
    }
}
