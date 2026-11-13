import * as assert from "assert";
import { IDirectory } from "../../src/models/IDirectory";
import { IScript } from "../../src/models/IScript";
import { ScriptId } from "../../src/models/ScriptId";
import { RemoteScriptRepository, RemoteScriptRepositoryDeps } from "../../src/services/remote/RemoteScriptRepository";

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

suite("MCP script repository", () => {
    test("concurrent ensureLoaded calls download the objects once", async () => {
        let scriptDownloads = 0;
        let directoryDownloads = 0;

        const deps = <RemoteScriptRepositoryDeps><unknown>{
            scriptRemote: {
                downloadAllScripts: async () => {
                    scriptDownloads++;
                    await delay(5);
                    return <IScript[]>[{ _id: new ScriptId("script.js.common.A"), type: "script", common: {} }];
                },
                downloadScriptWithId: async () => null,
                registerScriptChangedEventListener: () => undefined
            },
            directories: {
                downloadAllDirectories: async () => {
                    directoryDownloads++;
                    await delay(5);
                    return <IDirectory[]>[];
                },
                downloadDirectory: async () => null
            }
        };

        const repository = new RemoteScriptRepository(deps);
        await Promise.all([repository.ensureLoaded(), repository.ensureLoaded(), repository.ensureLoaded()]);

        assert.strictEqual(scriptDownloads, 1);
        assert.strictEqual(directoryDownloads, 1);
        assert.strictEqual(repository.isLoaded(), true);

        // A later call uses the cache and does not download again.
        await repository.ensureLoaded();
        assert.strictEqual(scriptDownloads, 1);
    });

    test("a single refresh tells scripts and channels apart by the object type", async () => {
        const repository = new RemoteScriptRepository(<RemoteScriptRepositoryDeps><unknown>{
            scriptRemote: {
                downloadAllScripts: async () => <IScript[]>[{ _id: new ScriptId("script.js.common.A"), type: "script", common: {} }],
                downloadScriptWithId: async (id: ScriptId) => id.startsWith("script.js.common.Folder")
                    ? <IScript><unknown>{ _id: id, type: "channel", common: { name: "Folder" } }
                    : null,
                registerScriptChangedEventListener: () => undefined
            },
            directories: {
                downloadAllDirectories: async () => <IDirectory[]>[],
                downloadDirectory: async () => null
            }
        });

        await repository.ensureLoaded();
        await repository.updateSingleScriptOrDirectoryFromServer(new ScriptId("script.js.common.Folder"));

        assert.deepStrictEqual(repository.getAllDirectories().map(directory => `${directory._id}`), ["script.js.common.Folder"]);
        assert.strictEqual(repository.getScriptFromId(new ScriptId("script.js.common.Folder")), undefined);
        assert.ok(repository.getScriptFromId(new ScriptId("script.js.common.A")));
    });

    test("the rename rule lives on ScriptId, so create and rename agree", () => {
        // '&' and '#' are part of the ioBroker admin rename rule and must not be duplicated.
        assert.strictEqual(ScriptId.sanitizeName("a&b#c"), "a_b_c");
        assert.strictEqual(ScriptId.sanitizeName("a/b"), "a_b");
        assert.strictEqual(`${ScriptId.sanitizeId(new ScriptId("script.js.common.a&b"))}`, "script.js.common.a_b");
    });
});
