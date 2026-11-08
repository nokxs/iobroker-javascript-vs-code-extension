import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Writable } from 'stream';
import {
    DEFAULT_MIRROR_MAX_SIZE_MB,
    DEFAULT_MIRROR_RELATIVE_PATH,
    endWriteStream,
    formatMirrorLine,
    isRealPathInsideWorkspace,
    normalizeMaxSizeMb,
    resolveMirrorPath,
    shouldRotate,
} from '../../services/logMirror/LogMirror';
import { ILogMessage } from '../../models/ILogMessage';

function removeTree(dir: string): void {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        try {
            if (fs.lstatSync(full).isDirectory()) {
                removeTree(full);
            } else {
                fs.unlinkSync(full);
            }
        } catch {
            /* ignore */
        }
    }
    try {
        fs.rmdirSync(dir);
    } catch {
        /* ignore */
    }
}

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

        test('should reject a non-string config value', () => {
            assert.strictEqual(resolveMirrorPath(workspaceRoot, 1), undefined);
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

    suite('isRealPathInsideWorkspace', () => {
        let root: string;
        let outside: string;

        setup(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'iobroker-mirror-in-'));
            outside = fs.mkdtempSync(path.join(os.tmpdir(), 'iobroker-mirror-out-'));
        });

        teardown(() => {
            for (const dir of [root, outside]) {
                try {
                    removeTree(dir);
                } catch {
                    /* ignore */
                }
            }
        });

        test('should accept a normal nested file path', () => {
            const nested = path.join(root, 'docs');
            fs.mkdirSync(nested, { recursive: true });
            const target = path.join(nested, 'live.log');
            assert.strictEqual(isRealPathInsideWorkspace(root, target), true);
        });

        test('should reject a directory junction/symlink that escapes the workspace', function () {
            const link = path.join(root, 'escape');
            try {
                fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
            } catch (e: any) {
                if (e && (e.code === 'EPERM' || e.code === 'EACCES')) {
                    this.skip();
                }
                throw e;
            }

            const target = path.join(link, 'live.log');
            assert.strictEqual(isRealPathInsideWorkspace(root, target), false);
        });

        test('should reject a leaf file symlink', function () {
            const nested = path.join(root, 'docs');
            fs.mkdirSync(nested, { recursive: true });
            const outsideFile = path.join(outside, 'secret.log');
            fs.writeFileSync(outsideFile, 'secret');
            const link = path.join(nested, 'live.log');
            try {
                fs.symlinkSync(outsideFile, link, process.platform === 'win32' ? 'file' : undefined);
            } catch (e: any) {
                if (e && (e.code === 'EPERM' || e.code === 'EACCES')) {
                    this.skip();
                }
                throw e;
            }

            assert.strictEqual(isRealPathInsideWorkspace(root, link), false);
        });

        test('should reject when the .1 rotation file is a symlink outside the workspace', function () {
            const nested = path.join(root, 'docs');
            fs.mkdirSync(nested, { recursive: true });
            const target = path.join(nested, 'live.log');
            fs.writeFileSync(target, 'current');
            const outsideFile = path.join(outside, 'secret.log');
            fs.writeFileSync(outsideFile, 'secret');
            const rotatedLink = `${target}.1`;
            try {
                fs.symlinkSync(outsideFile, rotatedLink, process.platform === 'win32' ? 'file' : undefined);
            } catch (e: any) {
                if (e && (e.code === 'EPERM' || e.code === 'EACCES')) {
                    this.skip();
                }
                throw e;
            }

            assert.strictEqual(isRealPathInsideWorkspace(root, target), false);
        });
    });

    suite('endWriteStream', () => {
        test('should flush written data before resolving', async () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iobroker-mirror-'));
            const file = path.join(dir, 'flush.log');
            const stream = fs.createWriteStream(file, { flags: 'a' });
            stream.write('flushed-line\n');

            await endWriteStream(stream);

            assert.strictEqual(fs.readFileSync(file, 'utf8'), 'flushed-line\n');
            try {
                fs.unlinkSync(file);
                fs.rmdirSync(dir);
            } catch {
                /* ignore cleanup errors */
            }
        });

        test('should keep an error listener so delayed flush errors stay handled', async () => {
            let uncaught = 0;
            const onUncaught = () => { uncaught += 1; };
            process.on('uncaughtException', onUncaught);

            const stream = new Writable({
                write(_chunk, _enc, cb) { cb(); },
                final(cb) { cb(new Error('flush failed')); },
            });

            await endWriteStream(stream);
            stream.emit('error', new Error('late error'));
            await new Promise(resolve => setTimeout(resolve, 20));

            process.off('uncaughtException', onUncaught);
            assert.ok(stream.listenerCount('error') > 0);
            assert.strictEqual(uncaught, 0);
        });
    });
});
