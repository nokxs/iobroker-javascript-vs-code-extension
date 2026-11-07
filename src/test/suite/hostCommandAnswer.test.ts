import * as assert from 'assert';
import { readLogLinesAnswer } from '../../services/connection/hostCommandAnswer';

suite('hostCommandAnswer', () => {
    test('drops the trailing log size', () => {
        const answer = readLogLinesAnswer(['line 1', 'line 2', '4096']);

        assert.deepStrictEqual(answer, { lines: ['line 1', 'line 2'] });
    });

    test('reports a permission error from the socket', () => {
        for (const response of ['permissionError', { error: 'permissionError' }]) {
            const answer = readLogLinesAnswer(response);

            assert.ok('error' in answer);
            if ('error' in answer) {
                assert.ok(answer.error.includes('not allowed to read logs'));
            }
        }
    });

    test('rejects answers that are not log lines', () => {
        for (const response of [null, undefined, 'timeout', [1, 2]]) {
            const answer = readLogLinesAnswer(response);

            assert.ok('error' in answer, `expected an error for ${JSON.stringify(response)}`);
        }
    });
});
