import * as assert from 'assert';
import { replaceSecretPlaceholders } from '../../services/scriptRemote/ScriptRemoteService';

suite('ScriptRemoteService Test Suite', () => {
    suite('replaceSecretPlaceholders', () => {
        test('should replace placeholders with values from .env content', () => {
            // Arrange
            const source = "const token = '__IOBROKER_SECRET_API_TOKEN__';";
            const env = "API_TOKEN=abc123";

            // Act
            const result = replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, "const token = 'abc123';");
        });

        test('should keep placeholder if env key is missing', () => {
            // Arrange
            const source = "const token = '__IOBROKER_SECRET_API_TOKEN__';";
            const env = "OTHER_KEY=abc123";

            // Act
            const result = replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, source);
        });

        test('should support quoted env values and comments', () => {
            // Arrange
            const source = "const user = '__IOBROKER_SECRET_DB_USER__'; const pass = '__IOBROKER_SECRET_DB_PASS__';";
            const env = "# comment\nDB_USER=\"my user\"\nDB_PASS='my=pass'";

            // Act
            const result = replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, "const user = 'my user'; const pass = 'my=pass';");
        });
    });
});
