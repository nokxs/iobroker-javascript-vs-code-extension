import * as assert from 'assert';
import { LogService } from '../../services/log/LogService';

suite('LogService Test Suite', () => {

    suite('extractScriptIdFromMessage', () => {
        test('should extract script ID from valid log message', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.xmas: registered 2 subscriptions, 0 schedules, 0 messages, 0 logs and 0 file subscriptions';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.xmas');
        });

        test('should extract script ID with custom log text', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.xmas: Xmas: Setting left=false, right=false, outdoor=false';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.xmas');
        });

        test('should extract correct script ID when message contains script name in content', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.blinds: RelayBlinds[Panorama] on down: {"id":"0_userdata.0.RelayBlinds.Panorama.down","newState":{"val":true,"ts":1764235506885,"ack":false,"lc":1691346365321,"from":"system.adapter.javascript.0","q":0,"c":"script.js.logic.xmas","user":"system.user.admin"}}';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert - should extract the blinds script, not the xmas script from the JSON
            assert.strictEqual(result, 'script.js.logic.blinds');
        });

        test('should return null when message format is invalid (missing parenthesis)', () => {
            // Arrange
            const message = 'invalid message format';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, null);
        });

        test('should return null when message format is invalid (missing colon)', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.xmas no colon';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, null);
        });

        test('should handle script IDs with dots and underscores', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.blinds_v2: Opening blinds';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.blinds_v2');
        });

        test('should handle messages with multiple colons after script ID', () => {
            // Arrange
            const message = 'javascript.0 (4701) script.js.logic.xmas: Setting state: value is 123';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.xmas');
        });

        test('should handle messages with different spacing after process ID', () => {
            // Arrange
            const message = 'javascript.0 (4701)  script.js.logic.xmas:  Log message with extra spaces';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.xmas');
        });

        test('should handle messages with tabs and other whitespace', () => {
            // Arrange
            const message = 'javascript.0 (4701)\t\tscript.js.logic.xmas:\tLog message with tabs';

            // Act
            const result = LogService.extractScriptIdFromMessage(message);

            // Assert
            assert.strictEqual(result, 'script.js.logic.xmas');
        });

        test('should correctly identify different scripts', () => {
            // Arrange & Act & Assert
            const scripts = ['script.js.logic.xmas', 'script.js.logic.blinds', 'script.js.weather'];
            
            scripts.forEach(scriptName => {
                const message = `javascript.0 (4701) ${scriptName}: Some log message`;
                const result = LogService.extractScriptIdFromMessage(message);
                assert.strictEqual(result, scriptName, `Failed to extract ${scriptName}`);
            });
        });
    });
});

