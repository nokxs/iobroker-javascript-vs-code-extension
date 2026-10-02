import * as assert from 'assert';
import { formatError } from '../../services/formatError';

suite('formatError', () => {
    test('formats plain login error objects', () => {
        const error = { message: "Login failed. Received status code '400'", isLoginUrlAvailable: true };

        assert.strictEqual(formatError(error), "Login failed. Received status code '400'");
    });

    test('formats standard errors', () => {
        assert.strictEqual(formatError(new Error('Connection refused')), 'Connection refused');
    });

    test('does not stringify unknown objects as [object Object]', () => {
        assert.strictEqual(formatError({ reason: 'hidden' }), 'Unknown error object (properties: reason)');
    });
});
