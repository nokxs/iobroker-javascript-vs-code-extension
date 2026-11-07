import * as assert from "assert";
import { Uri } from "vscode";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { createScript } from "../../aiTools/core/createScript";
import { deleteScript } from "../../aiTools/core/deleteScript";
import { downloadScript } from "../../aiTools/core/downloadScript";
import { getScriptContent } from "../../aiTools/core/getScriptContent";
import { getScripts } from "../../aiTools/core/getScripts";
import { getLogs } from "../../aiTools/core/getLogs";
import { getState } from "../../aiTools/core/getState";
import { renameScript } from "../../aiTools/core/renameScript";
import { uploadScript } from "../../aiTools/core/uploadScript";
import { ToolDeps } from "../../aiTools/core/types";
import { validateName } from "../../aiTools/core/validation";

interface FakeWorld {
    deps: ToolDeps
    scripts: ILocalScript[]
    directories: IDirectory[]
    written: Map<string, string>
    uploaded: IScript[]
}

function fakeUri(filePath: string): Uri {
    return <Uri><unknown>{ fsPath: filePath, path: filePath };
}

function localScript(scriptId: string, source = "", isDirty = false): ILocalScript {
    const filePath = `/${scriptId.replace(/^script\.js\./, "").replace(/\./g, "/")}.js`;
    const id = new ScriptId(scriptId);

    return {
        _id: id,
        ioBrokerScript: {
            _id: id,
            type: "script",
            common: {
                name: scriptId.substring(scriptId.lastIndexOf(".") + 1),
                engineType: "javascript/js",
                source: source,
                enabled: false
            }
        },
        absoluteUri: fakeUri(filePath),
        relativeUri: fakeUri(filePath),
        isDirty: isDirty,
        isRemoteOnly: false
    };
}

function createWorld(scripts: ILocalScript[] = [], directories: IDirectory[] = []): FakeWorld {
    const written = new Map<string, string>();
    const uploaded: IScript[] = [];
    const root: IDirectory = {
        _id: <ScriptId><unknown>"script.js",
        common: {},
        relativeUri: fakeUri("/ws/scripts"),
        absoluteUri: fakeUri("/ws/scripts")
    };

    const deps: ToolDeps = {
        connection: { isConnected: () => true },
        scripts: {
            getAllScripts: () => scripts,
            getAllDirectories: () => directories,
            getRootDirectory: () => root,
            getScriptFromId: (id: ScriptId) => scripts.find(s => `${s._id}` === `${id}`),
            getAllChangedScripts: () => scripts.filter(s => s.isDirty),
            getScriptWithLocalContent: async (script: ILocalScript) => script.ioBrokerScript,
            updateFromServer: async () => undefined,
            updateSingleScriptOrDirectoryFromServer: async () => undefined,
            evaluateDirtyState: async () => undefined,
            evaluateDirtyStateForAllScripts: async () => undefined,
            evaluateScriptOnRemote: async () => undefined,
            evaluateScriptOnRemoteForAllScripts: async () => undefined
        },
        scriptRemote: {
            uploadScript: async (script: IScript) => { uploaded.push(script); },
            downloadScriptWithId: async () => <IScript><unknown>null,
            startScript: async () => undefined,
            stopScript: async () => undefined,
            rename: async () => undefined,
            move: async () => undefined,
            delete: async () => undefined
        },
        script: {
            getFileContentOnDisk: async (uri: Uri) => written.has(uri.fsPath) ? <string>written.get(uri.fsPath) : null,
            getDefaultScript: (id: ScriptId) => (<IScript>{ _id: id, common: { name: `${id}`.substring(`${id}`.lastIndexOf(".") + 1), engineType: "javascript/js" } }),
            getFileExtension: () => "js"
        },
        scriptCreation: {
            createFileWithName: async (directory: IDirectory, fileName: string, fileExtension: string) => {
                written.set(`${directory.absoluteUri.fsPath}/${fileName}${fileExtension}`, "");
                return <IScript>{ _id: <ScriptId><unknown>`${directory._id}.${fileName}`, common: { name: fileName, engineType: "javascript/js" } };
            }
        },
        scriptId: { sanatizeId: (id: ScriptId) => id },
        files: {
            exists: () => false,
            write: async () => fakeUri("/ws/scripts/x.js"),
            writeContent: async (uri: Uri, content: string) => { written.set(uri.fsPath, content); },
            rename: async () => fakeUri("/ws/scripts/renamed.js"),
            move: async () => fakeUri("/ws/scripts/moved.js"),
            delete: async () => true,
            getFileUri: (directory: IDirectory, fileName: string, fileExtension: string) => fakeUri(`${directory.absoluteUri.fsPath}/${fileName}${fileExtension}`)
        },
        jsInstances: { getAvailableInstances: async () => [{ _id: "system.adapter.javascript.0" }] },
        states: {
            getState: async (id: string) => ({ val: 21.5, ack: true, ts: 1000, lc: 900, from: "system.adapter.javascript.0", id: id })
        },
        logs: {
            getHosts: async () => [{ id: "system.host.home", name: "home" }],
            getLogs: async () => [
                "2026-11-07 20:00:00.001 - info: javascript.0 (123) script.js.common.Light: started",
                "2026-11-07 20:00:01.001 - warn: javascript.0 (123) script.js.common.Light: missing state",
                "2026-11-07 20:00:02.001 - error: system.adapter.admin.0: failed to load"
            ]
        },
        documents: { isDirty: () => false }
    };

    return { deps: deps, scripts: scripts, directories: directories, written: written, uploaded: uploaded };
}

suite("AI tools core", () => {
    test("get_scripts returns the root directory, directories and scripts", async () => {
        const directory: IDirectory = { _id: <ScriptId><unknown>"script.js.common", common: { name: "common" }, relativeUri: fakeUri("/ws/scripts/common"), absoluteUri: fakeUri("/ws/scripts/common") };
        const world = createWorld([localScript("script.js.common.Licht")], [directory]);

        const outcome = await getScripts(world.deps, {});

        assert.strictEqual(outcome.ok, true);
        if (!outcome.ok) {
            return;
        }

        assert.deepStrictEqual(outcome.data.directories.map(d => d.id), ["script.js", "script.js.common"]);
        assert.strictEqual(outcome.data.scripts.length, 1);
        assert.strictEqual(outcome.data.scripts[0].scriptId, "script.js.common.Licht");
        assert.strictEqual(outcome.data.truncated, false);
    });

    test("get_scripts honours pathPrefix and limit", async () => {
        const world = createWorld([
            localScript("script.js.common.A"),
            localScript("script.js.common.B"),
            localScript("script.js.other.C")
        ]);

        const prefixed = await getScripts(world.deps, { pathPrefix: "script.js.common" });
        assert.strictEqual(prefixed.ok, true);
        if (prefixed.ok) {
            assert.deepStrictEqual(prefixed.data.scripts.map(s => s.scriptId), ["script.js.common.A", "script.js.common.B"]);
        }

        const limited = await getScripts(world.deps, { limit: 1 });
        assert.strictEqual(limited.ok, true);
        if (limited.ok) {
            assert.strictEqual(limited.data.scripts.length, 1);
            assert.strictEqual(limited.data.truncated, true);
        }
    });

    test("get_script_content prefers the file on disk and marks truncation", async () => {
        const script = localScript("script.js.common.Licht", "server content");
        const world = createWorld([script]);
        world.written.set(script.absoluteUri.fsPath, "local content");

        const outcome = await getScriptContent(world.deps, { scriptId: "script.js.common.Licht", maxLength: 5 });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.source, "local");
            assert.strictEqual(outcome.data.fromDisk, true);
            assert.strictEqual(outcome.data.truncated, true);
        }
    });

    test("get_script_content falls back to the server source", async () => {
        const world = createWorld([localScript("script.js.common.Licht", "server content")]);

        const outcome = await getScriptContent(world.deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.source, "server content");
            assert.strictEqual(outcome.data.fromDisk, false);
        }
    });

    test("tools reject unknown scripts", async () => {
        const world = createWorld([localScript("script.js.common.Licht")]);

        const outcome = await getScriptContent(world.deps, { scriptId: "script.js.common.Unknown" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_found");
        }
    });

    test("tools reject ids outside of the script namespace", async () => {
        const world = createWorld([localScript("script.js.common.Licht")]);

        const outcome = await uploadScript(world.deps, { scriptId: "javascript.0.scriptEnabled.Foo" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }
    });

    test("tools report a missing connection instead of connecting", async () => {
        const world = createWorld([localScript("script.js.common.Licht")]);
        const deps: ToolDeps = { ...world.deps, connection: { isConnected: () => false } };

        const outcome = await uploadScript(deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_connected");
            assert.ok(outcome.error.hint);
        }
    });

    test("upload_script uploads the local content", async () => {
        const script = localScript("script.js.common.Licht", "server content");
        const world = createWorld([script]);
        world.written.set(script.absoluteUri.fsPath, "local content");

        const outcome = await uploadScript(world.deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, true);
        assert.strictEqual(world.uploaded.length, 1);
    });

    test("download_script refuses to overwrite unsaved editor changes", async () => {
        const script = localScript("script.js.common.Licht");
        const world = createWorld([script]);
        const deps: ToolDeps = { ...world.deps, documents: { isDirty: () => true } };

        const outcome = await downloadScript(deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "unsaved_changes");
        }
    });

    test("download_script writes the server content to the file", async () => {
        const script = localScript("script.js.common.Licht");
        const world = createWorld([script]);
        const deps: ToolDeps = {
            ...world.deps,
            scriptRemote: { ...world.deps.scriptRemote, downloadScriptWithId: async () => <IScript>{ _id: script._id, common: { source: "from server" } } }
        };

        const outcome = await downloadScript(deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, true);
        assert.strictEqual(world.written.get(script.absoluteUri.fsPath), "from server");
    });

    test("create_script rejects path traversal in the file name", async () => {
        const world = createWorld();

        const outcome = await createScript(world.deps, { fileName: "../evil", language: "javascript" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }
    });

    test("create_script rejects unknown directories", async () => {
        const world = createWorld();

        const outcome = await createScript(world.deps, { fileName: "Test", language: "javascript", directoryId: "script.js.missing" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_found");
        }
    });

    test("create_script creates the script in the root directory by default", async () => {
        const world = createWorld();

        const outcome = await createScript(world.deps, { fileName: "MyScript", language: "javascript" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.scriptId, "script.js.MyScript");
            assert.strictEqual(outcome.data.filePath, "/ws/scripts/MyScript.js");
        }
    });

    test("rename_script reports the id of the renamed script", async () => {
        const world = createWorld([localScript("script.js.common.Licht")]);

        const outcome = await renameScript(world.deps, { scriptId: "script.js.common.Licht", newName: "Lampe" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.oldScriptId, "script.js.common.Licht");
            assert.strictEqual(outcome.data.newScriptId, "script.js.common.Lampe");
        }
    });

    test("delete_script reports the deleted file", async () => {
        const script = localScript("script.js.common.Licht");
        const world = createWorld([script]);

        const outcome = await deleteScript(world.deps, { scriptId: "script.js.common.Licht" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.deletedFilePath, script.absoluteUri.fsPath);
        }
    });

    test("get_state returns the value of the state", async () => {
        const world = createWorld();

        const outcome = await getState(world.deps, { stateId: "0_userdata.0.temperature" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.value, 21.5);
            assert.strictEqual(outcome.data.acknowledged, true);
        }
    });

    test("get_logs filters by severity, source and text", async () => {
        const world = createWorld();

        const outcome = await getLogs(world.deps, {
            source: "javascript.0",
            search: "missing"
        });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.hostId, "system.host.home");
            assert.strictEqual(outcome.data.scannedLines, 3);
            assert.deepStrictEqual(outcome.data.entries, [
                "2026-11-07 20:00:01.001 - warn: javascript.0 (123) script.js.common.Light: missing state"
            ]);
            assert.strictEqual(outcome.data.truncated, false);
        }

        const severityOutcome = await getLogs(world.deps, { level: "warn" });
        assert.strictEqual(severityOutcome.ok, true);
        if (severityOutcome.ok) {
            assert.strictEqual(severityOutcome.data.entries.length, 2);
            assert.ok(severityOutcome.data.entries.some(line => line.includes("error:")));
        }
    });

    test("get_logs caps the response character count", async () => {
        const world = createWorld();
        world.deps.logs.getLogs = async () => ["x".repeat(30001)];

        const outcome = await getLogs(world.deps, {});

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.truncated, true);
            assert.ok(outcome.data.entries.join("").length <= 30000);
        }
    });

    test("get_logs requires a host when multiple hosts are configured", async () => {
        const world = createWorld();
        world.deps.logs.getHosts = async () => [
            { id: "system.host.home", name: "home" },
            { id: "system.host.server", name: "server" }
        ];

        const outcome = await getLogs(world.deps, {});

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "ambiguous");
            assert.ok(outcome.error.hint?.includes("system.host.server"));
        }
    });

    test("validateName rejects separators and traversal", () => {
        assert.strictEqual(validateName("MyScript", "fileName").ok, true);
        assert.strictEqual(validateName("My Script", "fileName").ok, true);
        assert.strictEqual(validateName("a/b", "fileName").ok, false);
        assert.strictEqual(validateName("..", "fileName").ok, false);
        assert.strictEqual(validateName("../../x", "fileName").ok, false);
        assert.strictEqual(validateName("", "fileName").ok, false);
        assert.strictEqual(validateName(".hidden", "fileName").ok, false);
    });
});
