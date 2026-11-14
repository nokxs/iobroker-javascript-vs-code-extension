/**
 * Rules for ioBroker object/state ids and for the glob patterns of the writable-state allowlist.
 *
 * The rules live next to the value they describe, so the configuration parser, the AI tools and
 * the documentation all use the same implementation. The matcher is deliberately tiny instead of
 * a general glob library: ioBroker patterns know only `*` and `?`, and a second dialect (for
 * example brace expansion) would make an allowlist entry behave differently than its author
 * expects.
 */
export class IoBrokerId {
    private constructor() { }

    /**
     * True for a concrete id that may be written: no whitespace, no wildcard and no empty
     * segment. A pattern is not a writable id, and an id with a `?` or `*` in it would otherwise
     * only fail later as `not_found` after a pointless roundtrip.
     */
    static isValid(id: string): boolean {
        return typeof id === "string" &&
            id.length > 0 &&
            !/[\s*?]/.test(id) &&
            !id.startsWith(".") &&
            !id.endsWith(".") &&
            !id.includes("..");
    }

    /**
     * Matches one id against one pattern, anchored at both ends. `*` matches any sequence,
     * dots included (`0_userdata.0.*` covers the whole subtree), `?` matches exactly one
     * character, every other character is literal. The comparison is case sensitive, like the
     * ioBroker object database.
     */
    static matchesPattern(id: string, pattern: string): boolean {
        let idIndex = 0;
        let patternIndex = 0;
        let starIndex = -1;
        let starIdIndex = 0;

        while (idIndex < id.length) {
            if (patternIndex < pattern.length && (pattern[patternIndex] === "?" || pattern[patternIndex] === id[idIndex])) {
                idIndex++;
                patternIndex++;
                continue;
            }

            if (patternIndex < pattern.length && pattern[patternIndex] === "*") {
                starIndex = patternIndex;
                starIdIndex = idIndex;
                patternIndex++;
                continue;
            }

            if (starIndex < 0) {
                return false;
            }

            patternIndex = starIndex + 1;
            idIndex = ++starIdIndex;
        }

        while (patternIndex < pattern.length && pattern[patternIndex] === "*") {
            patternIndex++;
        }

        return patternIndex === pattern.length;
    }

    static matchesAny(id: string, patterns: readonly string[]): boolean {
        return patterns.some(pattern => IoBrokerId.matchesPattern(id, pattern));
    }

    /**
     * The deepest id prefix that contains every match of `pattern`, used to avoid a full object
     * scan for discovery. `0_userdata.0.*` answers `0_userdata.0`, while a partial segment
     * (`0_userdata.0.temp*`) falls back to `0_userdata.0`. An empty answer means a full scan is
     * required.
     */
    static parentPrefixOf(pattern: string): string {
        const wildcard = pattern.search(/[*?]/);
        const literal = wildcard < 0 ? pattern : pattern.substring(0, wildcard);
        if (literal.length === 0) {
            return "";
        }

        if (literal.endsWith(".")) {
            return literal.substring(0, literal.length - 1);
        }

        const lastDot = literal.lastIndexOf(".");
        return lastDot < 0 ? "" : literal.substring(0, lastDot);
    }
}
