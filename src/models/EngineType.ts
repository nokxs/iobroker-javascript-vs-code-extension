export enum EngineType {
    unkown = "",
    javascript = "javascript/js",
    typescript = "typescript/ts",
    blockly = "blockly",
    rules = "rules"
}

/**
 * Everything the extension needs to know about a single engine type.
 */
export interface EngineTypeInfo {
    /** Value written to `common.engineType` on the ioBroker server. */
    readonly ioBrokerType: string;
    /** File extension of the local script file. */
    readonly fileExtension: string;
    /** VS Code language id used when a script has no local file. */
    readonly languageId: string;
    /** File name of the icon inside the bundled `resources` folder. */
    readonly icon: string;
}

/**
 * Single source of truth for the per engine type knowledge. It used to be spread over
 * `ScriptService.getFileExtension`, `ScriptRemoteService.getFixedEngineTypeCasing`,
 * `OpenFileCommand.getScriptLanguage` and `ScriptItem.getIconPath`, which is how Blockly
 * and Rules could end up swapped.
 */
const ENGINE_TYPE_INFOS: { readonly [key: string]: EngineTypeInfo } = {
    [EngineType.javascript]: {
        ioBrokerType: "Javascript/js",
        fileExtension: "js",
        languageId: "javascript",
        icon: "javascript.svg"
    },
    [EngineType.typescript]: {
        ioBrokerType: "TypeScript/ts",
        fileExtension: "ts",
        languageId: "typescript",
        icon: "typescript.svg"
    },
    [EngineType.blockly]: {
        ioBrokerType: "Blockly",
        fileExtension: "block",
        languageId: "blockly",
        icon: "blockly.svg"
    },
    [EngineType.rules]: {
        ioBrokerType: "Rules",
        fileExtension: "rules",
        languageId: "rules",
        icon: "rules.svg"
    }
};

/**
 * Maps any `common.engineType` variant ("Javascript/js", "javascript", "TypeScript/ts",
 * "Blockly", "Rules", ...) to the canonical `EngineType` value.
 */
export function normalizeEngineType(engineType: string | undefined | null): EngineType {
    const base = engineType?.toLowerCase().split("/")[0].trim() ?? "";

    return ENGINE_TYPE_ALIASES[base] ?? EngineType.unkown;
}

/**
 * Maps any `common.engineType` variant to its metadata. Returns `undefined` for unknown
 * engine types, so callers can keep the original value instead of destroying it.
 */
export function getEngineTypeInfo(engineType: string | undefined | null): EngineTypeInfo | undefined {
    return ENGINE_TYPE_INFOS[normalizeEngineType(engineType)];
}

/**
 * Reverse of {@link getEngineTypeInfo}: resolves the engine type of a local file by its
 * extension (without the leading dot).
 */
export function getEngineTypeFromFileExtension(extension: string): EngineType {
    return ENGINE_TYPE_BY_EXTENSION[extension.toLowerCase()] ?? EngineType.unkown;
}

/**
 * All accepted spellings of an engine type, derived from the enum values (`"javascript/js"`
 * yields the aliases `"javascript"` and `"js"`), so a new engine type only needs an enum entry.
 */
const ENGINE_TYPE_ALIASES: { readonly [alias: string]: EngineType } = buildAliasTable();

/** Reverse lookup of {@link ENGINE_TYPE_INFOS}, keyed by the file extension. */
const ENGINE_TYPE_BY_EXTENSION: { readonly [extension: string]: EngineType } = buildExtensionTable();

function buildAliasTable(): { readonly [alias: string]: EngineType } {
    const aliases: { [alias: string]: EngineType } = {};
    const engineTypes = EngineType as unknown as { readonly [key: string]: EngineType };

    for (const key of Object.keys(engineTypes)) {
        const engineType = engineTypes[key];
        if (engineType === EngineType.unkown) {
            continue;
        }

        for (const alias of engineType.split("/")) {
            aliases[alias] = engineType;
        }
    }

    return aliases;
}

function buildExtensionTable(): { readonly [extension: string]: EngineType } {
    const extensions: { [extension: string]: EngineType } = {};

    for (const key of Object.keys(ENGINE_TYPE_INFOS)) {
        extensions[ENGINE_TYPE_INFOS[key].fileExtension] = key as EngineType;
    }

    return extensions;
}
