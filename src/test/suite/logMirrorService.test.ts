import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Uri, WorkspaceFolder } from 'vscode';
import { AdminVersion, Config } from '../../models/Config';
import { ILogMessage } from '../../models/ILogMessage';
import { IConfigRepositoryService } from '../../services/configRepository/IConfigRepositoryService';
import { LogMirrorService } from '../../services/logMirror/LogMirrorService';

function createFolder(root: string): WorkspaceFolder {
    return {
        uri: Uri.file(root),
        name: path.basename(root),
        index: 0,
    } as WorkspaceFolder;
}

function createConfig(overrides: Partial<{
    mirror: boolean;
    relativePath: unknown;
    maxSizeMb: number;
}>): Config {
    return new Config(
        'http://localhost',
        8081,
        '/',
        AdminVersion.admin7,
        true,
        undefined,
        false,
        'admin',
        false,
        false,
        false,
        false,
        '20.14.10',
        false,
        overrides.mirror,
        overrides.relativePath as string | undefined,
        overrides.maxSizeMb,
    );
}

function createConfigRepo(config: Config, delayMs = 0): IConfigRepositoryService {
    return {
        config,
        read: async () => {
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            return config;
        },
        write: async () => undefined,
    };
}

function sampleMessage(text: string): ILogMessage {
    return {
        severity: 'info',
        ts: Date.UTC(2026, 10, 8, 3, 0, 0),
        message: `javascript.0 (1) script.js.demo: ${text}`,
        from: 'javascript.0',
        _id: 1,
    };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const started = Date.now();
    while (!predicate()) {
        if (Date.now() - started > timeoutMs) {
            throw new Error('Timed out waiting for condition');
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

suite('LogMirrorService Test Suite', () => {
    let tempRoot: string;

    setup(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iobroker-mirror-svc-'));
    });

    teardown(async () => {
        try {
            const entries = fs.readdirSync(tempRoot);
            for (const entry of entries) {
                try {
                    fs.unlinkSync(path.join(tempRoot, entry));
                } catch {
                    /* ignore */
                }
            }
            fs.rmdirSync(tempRoot);
        } catch {
            /* ignore */
        }
    });

    test('write then disposeAsync flushes the line to disk', async () => {
        const relative = 'logs/flush.log';
        const target = path.join(tempRoot, relative);
        const service = new LogMirrorService(createConfigRepo(createConfig({
            mirror: true,
            relativePath: relative,
        })));

        await service.open(createFolder(tempRoot));
        service.write(sampleMessage('flushed'));
        await service.disposeAsync();

        const content = fs.readFileSync(target, 'utf8');
        assert.ok(content.includes('mirror started'));
        assert.ok(content.includes('script.js.demo: flushed'));
        assert.strictEqual((service as any).mirrorStream, undefined);
    });

    test('open rotates an oversized existing file to .1', async function () {
        this.timeout(10000);
        const relative = 'logs/rotate-open.log';
        const target = path.join(tempRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'x'.repeat(300));

        const service = new LogMirrorService(createConfigRepo(createConfig({
            mirror: true,
            relativePath: relative,
            maxSizeMb: 0.0001,
        })));

        await service.open(createFolder(tempRoot));
        await service.disposeAsync();

        assert.ok(fs.existsSync(`${target}.1`), 'expected rotated .1 file after open');
        const content = fs.readFileSync(target, 'utf8');
        assert.ok(content.includes('mirror started'));
    });

    test('runtime rotation creates .1 and writes a rotated header', async function () {
        this.timeout(15000);
        const relative = 'logs/rotate-runtime.log';
        const target = path.join(tempRoot, relative);
        const service = new LogMirrorService(createConfigRepo(createConfig({
            mirror: true,
            relativePath: relative,
            maxSizeMb: 0.0001,
        })));

        await service.open(createFolder(tempRoot));
        assert.strictEqual((service as any).maxSizeMb, 0.0001, 'maxSizeMb should come from config');
        for (let i = 0; i < 40; i++) {
            service.write(sampleMessage(`line-${i}-${'x'.repeat(40)}`));
        }

        await waitFor(() => fs.existsSync(`${target}.1`), 10000);
        await waitFor(() => (service as any).rotating === false, 10000);
        // Flush buffered writes before asserting file contents.
        await service.disposeAsync();
        assert.ok(fs.existsSync(`${target}.1`));
        assert.ok(
            fs.readFileSync(target, 'utf8').includes('log mirror rotated'),
            'expected rotated header after runtime rotation',
        );
    });

    test('non-string path does not create a mirror file', async () => {
        const config = createConfig({ mirror: true, relativePath: 'ignored.log' });
        (config as { ioBrokerLogMirrorRelativePath?: unknown }).ioBrokerLogMirrorRelativePath = 1;
        const service = new LogMirrorService(createConfigRepo(config));

        await service.open(createFolder(tempRoot));
        await service.disposeAsync();

        const files = fs.readdirSync(tempRoot);
        assert.deepStrictEqual(files, []);
        assert.strictEqual((service as any).mirrorStream, undefined);
    });

    test('dispose during open leaves no stream and no started header', async function () {
        this.timeout(10000);
        const relative = 'logs/race.log';
        const target = path.join(tempRoot, relative);
        const service = new LogMirrorService(createConfigRepo(createConfig({
            mirror: true,
            relativePath: relative,
        }), 80));

        const openPromise = service.open(createFolder(tempRoot));
        service.dispose();
        await openPromise;

        assert.strictEqual((service as any).mirrorStream, undefined);
        if (fs.existsSync(target)) {
            const content = fs.readFileSync(target, 'utf8');
            assert.ok(!content.includes('mirror started'));
        }
    });
});
