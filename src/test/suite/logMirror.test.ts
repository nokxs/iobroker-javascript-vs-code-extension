import * as assert from 'assert';
import * as path from 'path';
import {
    DEFAULT_MIRROR_MAX_SIZE_MB,
    DEFAULT_MIRROR_RELATIVE_PATH,
    formatMirrorLine,
    normalizeMaxSizeMb,
    resolveMirrorPath,
    shouldRotate,
} from '../../services/logMirror/LogMirror';
import { ILogMessage } from '../../models/ILogMessage';

suite('LogMirror Test Suite', () => {
    const workspaceRoot = path.resolve('/tmp/iobroker-workspace');

    suite('resolveMirrorPath', () => {
        test('should use the default relative path when unset', () => {
            const result = resolveMirrorPath(workspaceRoot, undefined);
            assert.strictEqual(result, path.resolve(workspaceRoot, DEFAULT_MIRROR_RELATIVE_PATH));
        });

        test('should accept a nested workspace-relative path', () => {
            const result = resolveMirrorPath(workspaceRoot, 'docs/javascript-live.log');
            assert.strictEqual(result, path.resolve(workspaceRoot, 'docs/javascript-live.log'));
        });

        test('should reject paths that leave the workspace via ..', () => {
            assert.strictEqual(resolveMirrorPath(workspaceRoot, '../../.bashrc'), undefined);
        });

        test('should reject absolute paths', () => {
            const absolute = path.resolve('/etc/passwd');
            assert.strictEqual(resolveMirrorPath(workspaceRoot, absolute), undefined);
        });

        test('should treat a non-string config value as the default path', () => {
            const result = resolveMirrorPath(workspaceRoot, 1 as unknown as string);
            assert.strictEqual(result, path.resolve(workspaceRoot, DEFAULT_MIRROR_RELATIVE_PATH));
        });
    });

    suite('formatMirrorLine', () => {
        test('should use message.ts as the single ISO timestamp', () => {
            const message: ILogMessage = {
                severity: 'info',
                ts: Date.UTC(2026, 10, 8, 1, 27, 6, 318),
                message: 'javascript.0 (1) script.js.demo: hello',
                from: 'javascript.0',
                _id: 1,
            };

            assert.strictEqual(
                formatMirrorLine(message),
                '2026-11-08T01:27:06.318Z info: javascript.0 (1) script.js.demo: hello',
            );
        });

        test('should fall back to nowMs when ts is missing', () => {
            const message = {
                severity: 'warn',
                message: 'javascript.0 (1) script.js.demo: missing ts',
                from: 'javascript.0',
                _id: 2,
            } as ILogMessage;

            assert.strictEqual(
                formatMirrorLine(message, Date.UTC(2026, 0, 1, 0, 0, 0)),
                '2026-01-01T00:00:00.000Z warn: javascript.0 (1) script.js.demo: missing ts',
            );
        });
    });

    suite('shouldRotate / normalizeMaxSizeMb', () => {
        test('should rotate when size reaches the configured limit', () => {
            assert.strictEqual(shouldRotate(10 * 1024 * 1024, 10), true);
            assert.strictEqual(shouldRotate(10 * 1024 * 1024 - 1, 10), false);
        });

        test('should not rotate for non-positive limits', () => {
            assert.strictEqual(shouldRotate(1_000_000, 0), false);
            assert.strictEqual(shouldRotate(1_000_000, -1), false);
        });

        test('should normalize invalid max size to the default', () => {
            assert.strictEqual(normalizeMaxSizeMb(undefined), DEFAULT_MIRROR_MAX_SIZE_MB);
            assert.strictEqual(normalizeMaxSizeMb('10'), DEFAULT_MIRROR_MAX_SIZE_MB);
            assert.strictEqual(normalizeMaxSizeMb(5), 5);
        });
    });
});
