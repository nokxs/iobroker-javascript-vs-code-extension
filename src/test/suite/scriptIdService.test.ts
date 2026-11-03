import * as assert from 'assert';
import { ScriptId } from '../../models/ScriptId';
import { IConfigRepositoryService } from '../../services/configRepository/IConfigRepositoryService';
import { ScriptIdService } from '../../services/scriptId/ScriptIdService';
import { IWorkspaceService } from '../../services/workspace/IWorkspaceService';

function createService(): ScriptIdService {
    return new ScriptIdService({} as IWorkspaceService, {} as IConfigRepositoryService);
}

suite('ScriptIdService Test Suite', () => {
    suite('sanatizeId', () => {
        test('should keep digits in script ids', () => {
            const result = createService().sanatizeId(new ScriptId("script.js.Pool.V69_pump_2026"));

            assert.strictEqual(result.toString(), "script.js.Pool.V69_pump_2026");
        });

        test('should replace forbidden characters', () => {
            const result = createService().sanatizeId(new ScriptId("script.js.My Script#1;<a>?"));

            assert.strictEqual(result.toString(), "script.js.My_Script_1__a__");
        });
    });
});
