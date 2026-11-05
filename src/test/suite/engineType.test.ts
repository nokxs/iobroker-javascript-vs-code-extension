import * as assert from 'assert';
import { EngineType, normalizeEngineType } from '../../models/EngineType';

suite('EngineType Test Suite', () => {
    suite('normalizeEngineType', () => {
        test('should map canonical and bare JavaScript variants', () => {
            assert.strictEqual(normalizeEngineType("Javascript/js"), EngineType.javascript);
            assert.strictEqual(normalizeEngineType("JavaScript/js"), EngineType.javascript);
            assert.strictEqual(normalizeEngineType("javascript"), EngineType.javascript);
        });

        test('should map canonical and bare TypeScript variants', () => {
            assert.strictEqual(normalizeEngineType("TypeScript/ts"), EngineType.typescript);
            assert.strictEqual(normalizeEngineType("typescript"), EngineType.typescript);
        });

        test('should keep Blockly and Rules apart', () => {
            assert.strictEqual(normalizeEngineType("Blockly"), EngineType.blockly);
            assert.strictEqual(normalizeEngineType("Rules"), EngineType.rules);
        });

        test('should return unknown for empty or unsupported values', () => {
            assert.strictEqual(normalizeEngineType(undefined), EngineType.unkown);
            assert.strictEqual(normalizeEngineType(""), EngineType.unkown);
            assert.strictEqual(normalizeEngineType("python"), EngineType.unkown);
        });
    });
});
