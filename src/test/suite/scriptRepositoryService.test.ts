import * as assert from "assert";
import { Uri } from "vscode";
import { AdminVersion, Config } from "../../models/Config";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { ScriptRepositoryService } from "../../services/scriptRepository/ScriptRepositoryService";

/**
 * A move triggers the socket event and an explicit refresh of the AI tool at the same time. Both
 * updates used to find a missing cache entry and insert the script twice, so it showed up twice in
 * the script explorer until the next full refresh.
 */
suite("ScriptRepositoryService", () => {
    function createService(downloadedScript: IScript | null): ScriptRepositoryService {
        const scriptRemoteService = {
            init: () => undefined,
            registerScriptChangedEventListener: () => undefined,
            downloadAllScripts: async () => [],
            downloadScriptWithUri: async () => <IScript><unknown>null,
            downloadScriptWithId: async () => <IScript>downloadedScript,
            uploadScript: async () => undefined,
            startScript: async () => undefined,
            stopScript: async () => undefined,
            update: async () => undefined,
            rename: async () => undefined,
            move: async () => undefined,
            delete: async () => undefined
        };

        const scriptService = {
            getFileExtension: () => "ts",
            getEngineType: () => <never><unknown>undefined,
            getDefaultScript: () => <IScript><unknown>undefined,
            getFileContentOnDisk: async () => "",
            saveToFile: async () => undefined,
            saveAllToFile: async () => undefined,
            existsScriptLocally: async () => true
        };

        return new ScriptRepositoryService(
            scriptRemoteService,
            { getIoBrokerId: () => new ScriptId("script.js.unknown"), sanatizeId: (id: ScriptId) => id },
            {
                downloadDirectory: async () => <never><unknown>null,
                downloadAllDirectories: async () => [],
                createDirectory: async () => undefined,
                createDirectoriesRecursively: async () => undefined,
                deleteDirectory: async () => undefined
            },
            {
                config: new Config("http://localhost:8081", 8081, "scripts", AdminVersion.admin7),
                read: async () => <Config><unknown>undefined,
                write: async () => undefined
            },
            scriptService,
            {
                workspaceToUse: <never>{ uri: Uri.file("/workspace") },
                getWorkspaceToUse: async () => <never><unknown>undefined,
                getWorkspacesWithConfig: async () => []
            },
            {
                startCollecting: async () => undefined,
                stopCollecting: () => undefined,
                isCollecting: () => false,
                log: () => undefined,
                logWarning: () => undefined,
                logError: () => undefined
            },
            {
                replaceSecretPlaceholders: (source: string) => source,
                replaceSecretPlaceholdersFromEnvFile: async (source: string) => source
            }
        );
    }

    test("a concurrent update adds a new script only once", async () => {
        const script: IScript = {
            _id: new ScriptId("script.js.test.test3.aaaa"),
            type: "script",
            common: { name: "aaaa", engineType: "typescript/ts", source: "", enabled: false }
        };
        const service = createService(script);

        await Promise.all([
            service.updateSingleScriptOrDirectoryFromServer(script._id),
            service.updateSingleScriptOrDirectoryFromServer(script._id)
        ]);

        assert.strictEqual(service.getAllScripts().length, 1);
        assert.strictEqual(`${service.getAllScripts()[0]._id}`, "script.js.test.test3.aaaa");
    });

    test("a repeated removal does not fail", async () => {
        const service = createService(null);

        await Promise.all([
            service.updateSingleScriptOrDirectoryFromServer(new ScriptId("script.js.test.test2.aaaa")),
            service.updateSingleScriptOrDirectoryFromServer(new ScriptId("script.js.test.test2.aaaa"))
        ]);

        assert.strictEqual(service.getAllScripts().length, 0);
    });
});
