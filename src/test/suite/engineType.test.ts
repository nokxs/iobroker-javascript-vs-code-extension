import * as assert from 'assert';
import {
    EngineType,
    getEngineTypeFromFileExtension,
    getEngineTypeInfo,
    normalizeEngineType
} from '../../models/EngineType';

suite('EngineType Test Suite', () => {
    suite('normalizeEngineType', () => {
        test('should map canonical and bare JavaScript variants', () => {
            assert.strictEqual(normalizeEngineType("Javascript/js"), EngineType.javascript);
            assert.strictEqual(normalizeEngineType("JavaScript/js"), EngineType.javascript);
            assert.strictEqual(normalizeEngineType("javascript"), EngineType.javascript);
            assert.strictEqual(normalizeEngineType("js"), EngineType.javascript);
        });

        test('should map canonical and bare TypeScript variants', () => {
            assert.strictEqual(normalizeEngineType("TypeScript/ts"), EngineType.typescript);
            assert.strictEqual(normalizeEngineType("typescript"), EngineType.typescript);
            assert.strictEqual(normalizeEngineType("ts"), EngineType.typescript);
        });

        test('should keep Blockly and Rules apart', () => {
            assert.strictEqual(normalizeEngineType("Blockly"), EngineType.blockly);
            assert.strictEqual(normalizeEngineType("blockly"), EngineType.blockly);
            assert.strictEqual(normalizeEngineType("Rules"), EngineType.rules);
            assert.strictEqual(normalizeEngineType("rules"), EngineType.rules);
        });

        test('should ignore surrounding whitespace', () => {
            assert.strictEqual(normalizeEngineType("  Javascript / js "), EngineType.javascript);
        });

        test('should return unknown for empty or unsupported values', () => {
            assert.strictEqual(normalizeEngineType(undefined), EngineType.unkown);
            assert.strictEqual(normalizeEngineType(null), EngineType.unkown);
            assert.strictEqual(normalizeEngineType(""), EngineType.unkown);
            assert.strictEqual(normalizeEngineType("python"), EngineType.unkown);
        });
    });

    suite('getEngineTypeInfo', () => {
        test('should return the ioBroker casing for uploads', () => {
            assert.strictEqual(getEngineTypeInfo("blockly")?.ioBrokerType, "Blockly");
            assert.strictEqual(getEngineTypeInfo("rules")?.ioBrokerType, "Rules");
            assert.strictEqual(getEngineTypeInfo("javascript")?.ioBrokerType, "Javascript/js");
            assert.strictEqual(getEngineTypeInfo("typescript")?.ioBrokerType, "TypeScript/ts");
        });

        test('should return extension, language and icon for each engine type', () => {
            assert.deepStrictEqual(getEngineTypeInfo("Javascript/js"), {
                ioBrokerType: "Javascript/js",
                fileExtension: "js",
                languageId: "javascript",
                icon: "javascript.svg"
            });
            assert.deepStrictEqual(getEngineTypeInfo("TypeScript/ts"), {
                ioBrokerType: "TypeScript/ts",
                fileExtension: "ts",
                languageId: "typescript",
                icon: "typescript.svg"
            });
            assert.deepStrictEqual(getEngineTypeInfo("Blockly"), {
                ioBrokerType: "Blockly",
                fileExtension: "block",
                languageId: "blockly",
                icon: "blockly.svg"
            });
            assert.deepStrictEqual(getEngineTypeInfo("Rules"), {
                ioBrokerType: "Rules",
                fileExtension: "rules",
                languageId: "rules",
                icon: "rules.svg"
            });
        });

        test('should return undefined for unknown engine types', () => {
            assert.strictEqual(getEngineTypeInfo(undefined), undefined);
            assert.strictEqual(getEngineTypeInfo(""), undefined);
            assert.strictEqual(getEngineTypeInfo("python"), undefined);
        });
    });

    suite('getEngineTypeFromFileExtension', () => {
        test('should resolve the engine type from the file extension', () => {
            assert.strictEqual(getEngineTypeFromFileExtension("js"), EngineType.javascript);
            assert.strictEqual(getEngineTypeFromFileExtension("ts"), EngineType.typescript);
            assert.strictEqual(getEngineTypeFromFileExtension("block"), EngineType.blockly);
            assert.strictEqual(getEngineTypeFromFileExtension("rules"), EngineType.rules);
        });

        test('should be case insensitive', () => {
            assert.strictEqual(getEngineTypeFromFileExtension("JS"), EngineType.javascript);
        });

        test('should return unknown for unsupported extensions', () => {
            assert.strictEqual(getEngineTypeFromFileExtension("txt"), EngineType.unkown);
            assert.strictEqual(getEngineTypeFromFileExtension(""), EngineType.unkown);
        });
    });
});
