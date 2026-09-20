import * as assert from 'assert';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { SecretPlaceholderService } from '../../services/scriptRemote/SecretPlaceholderService';
import { IWorkspaceService } from '../../services/workspace/IWorkspaceService';
import { WorkspaceFolder } from 'vscode';

function createService(workspacePath: string | undefined): SecretPlaceholderService {
    const workspaceService: IWorkspaceService = {
        workspaceToUse: workspacePath ? { uri: { fsPath: workspacePath } } as WorkspaceFolder : undefined as unknown as WorkspaceFolder,
        getWorkspaceToUse: () => Promise.resolve(undefined as unknown as WorkspaceFolder),
        getWorkspacesWithConfig: () => Promise.resolve([]),
    };
    return new SecretPlaceholderService(workspaceService);
}

suite('ScriptRemoteService Test Suite', () => {
    suite('replaceSecretPlaceholders', () => {
        test('should replace placeholders with values from .env content', () => {
            // Arrange
            const source = "const token = '__IOBROKER_SECRET_API_TOKEN__';";
            const env = "API_TOKEN=abc123";

            // Act
            const result = createService(undefined).replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, "const token = 'abc123';");
        });

        test('should keep placeholder if env key is missing', () => {
            // Arrange
            const source = "const token = '__IOBROKER_SECRET_API_TOKEN__';";
            const env = "OTHER_KEY=abc123";

            // Act
            const result = createService(undefined).replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, source);
        });

        test('should support quoted env values and comments', () => {
            // Arrange
            const source = "const user = '__IOBROKER_SECRET_DB_USER__'; const pass = '__IOBROKER_SECRET_DB_PASS__';";
            const env = "# comment\nDB_USER=\"my user\"\nDB_PASS='my=pass'";

            // Act
            const result = createService(undefined).replaceSecretPlaceholders(source, env);

            // Assert
            assert.strictEqual(result, "const user = 'my user'; const pass = 'my=pass';");
        });

        test('should replace placeholders from workspace .env file', async () => {
            // Arrange
            const workspacePath = mkdtempSync(join(tmpdir(), 'iobroker-secret-test-'));
            const source = "const token = '__IOBROKER_SECRET_API_TOKEN__';";
            writeFileSync(join(workspacePath, '.env'), 'API_TOKEN=file-token', 'utf8');

            // Act
            const result = await createService(workspacePath).replaceSecretPlaceholdersFromEnvFile(source);

            // Assert
            assert.strictEqual(result, "const token = 'file-token';");
        });
    });
});
