import * as assert from 'assert';
import { EngineType } from '../../models/EngineType';
import { IFileService } from '../../services/file/IFileService';
import { ScriptService } from '../../services/script/ScriptService';
import { IScriptIdService } from '../../services/scriptId/IScriptIdService';

function createService(): ScriptService {
    return new ScriptService({} as IFileService, {} as IScriptIdService);
}

suite('ScriptService Test Suite', () => {
    suite('getFileExtension', () => {
        test('should map the canonical engine types', () => {
            const service = createService();

            assert.strictEqual(service.getFileExtension(EngineType.javascript), "js");
            assert.strictEqual(service.getFileExtension(EngineType.typescript), "ts");
            assert.strictEqual(service.getFileExtension(EngineType.blockly), "block");
            assert.strictEqual(service.getFileExtension(EngineType.rules), "rules");
        });

        test('should accept engine types as stored by the server', () => {
            const service = createService();

            assert.strictEqual(service.getFileExtension("Javascript/js"), "js");
            assert.strictEqual(service.getFileExtension("TypeScript/ts"), "ts");
            assert.strictEqual(service.getFileExtension("Blockly"), "block");
            assert.strictEqual(service.getFileExtension("Rules"), "rules");
        });

        test('should accept bare engine types without a suffix', () => {
            const service = createService();

            assert.strictEqual(service.getFileExtension("javascript"), "js");
            assert.strictEqual(service.getFileExtension("typescript"), "ts");
            assert.strictEqual(service.getFileExtension("blockly"), "block");
            assert.strictEqual(service.getFileExtension("rules"), "rules");
        });

        test('should fall back to txt for unknown or missing engine types', () => {
            const service = createService();

            assert.strictEqual(service.getFileExtension(undefined), "txt");
            assert.strictEqual(service.getFileExtension(""), "txt");
            assert.strictEqual(service.getFileExtension("python"), "txt");
        });
    });
});
