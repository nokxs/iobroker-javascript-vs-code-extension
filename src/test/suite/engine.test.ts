import * as assert from 'assert';
import { getJsInstanceNumber } from '../../models/Engine';

suite('Engine Test Suite', () => {
    suite('getJsInstanceNumber', () => {
        test('should return the instance number of the engine id', () => {
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript.0"), 0);
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript.1"), 1);
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript.12"), 12);
        });

        test('should fall back to 0 without a numeric suffix', () => {
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript"), 0);
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript.host"), 0);
        });

        test('should fall back to 0 for missing values', () => {
            assert.strictEqual(getJsInstanceNumber(undefined), 0);
            assert.strictEqual(getJsInstanceNumber(""), 0);
        });

        test('should parse the number as decimal', () => {
            assert.strictEqual(getJsInstanceNumber("system.adapter.javascript.010"), 10);
        });
    });
});
