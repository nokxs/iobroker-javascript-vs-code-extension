export enum EngineType {
    unkown = "",
    javascript = "javascript/js",
    typescript = "typescript/ts",
    blockly = "blockly",
    rules = "rules"
}

/**
 * Normalizes arbitrary `common.engineType` values (as written by ioBroker admin,
 * the javascript adapter, REST/MCP uploaders, other third-party tools, …) into
 * the canonical `EngineType` enum value.
 *
 * Accepts all historically seen variants, including:
 *   - "Javascript/js", "javascript/js", "javascript" (bare)
 *   - "TypeScript/ts", "typescript/ts", "typescript" (bare)
 *   - "Blockly", "blockly"
 *   - "Rules", "rules"
 */
export function normalizeEngineType(engineType: string | undefined | null): EngineType {
    if (!engineType) {
        return EngineType.unkown;
    }

    const raw = engineType.toLowerCase().trim();
    // Split "foo/bar" into its base token so bare forms are accepted too.
    const base = raw.split("/")[0];

    switch (raw) {
        case EngineType.javascript:
        case EngineType.typescript:
        case EngineType.blockly:
        case EngineType.rules:
            return raw as EngineType;
    }

    switch (base) {
        case "javascript":
        case "js":
            return EngineType.javascript;
        case "typescript":
        case "ts":
            return EngineType.typescript;
        case "blockly":
            return EngineType.blockly;
        case "rules":
            return EngineType.rules;
    }

    return EngineType.unkown;
}
