export enum EngineType {
    unkown = "",
    javascript = "javascript/js",
    typescript = "typescript/ts",
    blockly = "blockly",
    rules = "rules"
}

/**
 * Maps any `common.engineType` variant ("Javascript/js", "javascript", "TypeScript/ts",
 * "Blockly", "Rules", ...) to the canonical `EngineType` value.
 */
export function normalizeEngineType(engineType: string | undefined | null): EngineType {
    if (!engineType) {
        return EngineType.unkown;
    }

    const base = engineType.toLowerCase().trim().split("/")[0];

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
