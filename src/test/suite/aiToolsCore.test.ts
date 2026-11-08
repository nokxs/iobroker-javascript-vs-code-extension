import * as assert from "assert";
import { Uri } from "vscode";
import { IDirectory } from "../../models/IDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { createDirectory } from "../../aiTools/core/createDirectory";
import { createScript } from "../../aiTools/core/createScript";
import { deleteDirectory } from "../../aiTools/core/deleteDirectory";
import { deleteScript } from "../../aiTools/core/deleteScript";
import { downloadScript } from "../../aiTools/core/downloadScript";
import { getScriptContent } from "../../aiTools/core/getScriptContent";
import { getScripts } from "../../aiTools/core/getScripts";
import { getLogs } from "../../aiTools/core/getLogs";
import { getState } from "../../aiTools/core/getState";
import { moveScript } from "../../aiTools/core/moveScript";
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
    localDirectories: Set<string>
    localFiles: Map<string, string[]>
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
    const localDirectories = new Set<string>();
    const localFiles = new Map<string, string[]>();
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
        directories: {
            downloadDirectory: async (id: ScriptId) => directories.find(d => `${d._id}` === `${id}`) ?? <IDirectory><unknown>null,
            createDirectory: async (id: ScriptId, name: string) => {
                directories.push({
                    _id: id,
                    common: { name: name },
                    relativeUri: fakeUri(`/${id}/`),
                    absoluteUri: fakeUri(`/ws/scripts/${(`${id}`.split(".").slice(2).join("/"))}`)
                });
            },
            createDirectoriesRecursively: async (id: ScriptId) => {
                const parts = `${id}`.split(".");
                for (let count = 3; count <= parts.length; count++) {
                    const directoryId = parts.slice(0, count).join(".");
                    if (directories.some(d => `${d._id}` === directoryId)) {
                        continue;
                    }

                    directories.push({
                        _id: <ScriptId><unknown>directoryId,
                        common: { name: parts[count - 1] },
                        relativeUri: fakeUri(`/${directoryId}/`),
                        absoluteUri: fakeUri(`/ws/scripts/${parts.slice(2, count).join("/")}`)
                    });
                }
            },
            deleteDirectory: async (id: ScriptId) => {
                const index = directories.findIndex(d => `${d._id}` === `${id}`);
                if (index >= 0) {
                    directories.splice(index, 1);
                }
            }
        },
        files: {
            exists: () => false,
            write: async () => fakeUri("/ws/scripts/x.js"),
            writeContent: async (uri: Uri, content: string) => { written.set(uri.fsPath, content); },
            rename: async () => fakeUri("/ws/scripts/renamed.js"),
            move: async () => fakeUri("/ws/scripts/moved.js"),
            delete: async () => true,
            getFileUri: (directory: IDirectory, fileName: string, fileExtension: string) => fakeUri(`${directory.absoluteUri.fsPath}/${fileName}${fileExtension}`),
            getDirectoryUri: (parentDirectoryUri: Uri, name: string) => fakeUri(`${parentDirectoryUri.fsPath}/${name}`),
            directoryExists: (uri: Uri) => localDirectories.has(uri.fsPath),
            isEmptyDirectory: (uri: Uri) => (localFiles.get(uri.fsPath) ?? []).length === 0,
            createDirectory: async (uri: Uri) => { localDirectories.add(uri.fsPath); },
            deleteDirectory: async (uri: Uri) => { localDirectories.delete(uri.fsPath); }
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

    return { deps: deps, scripts: scripts, directories: directories, written: written, uploaded: uploaded, localDirectories: localDirectories, localFiles: localFiles };
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

    test("create_directory creates the server directory and the local folder", async () => {
        const world = createWorld();

        const outcome = await createDirectory(world.deps, { directoryId: "script.js", name: "common" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.directoryId, "script.js.common");
            assert.strictEqual(outcome.data.path, "/ws/scripts/common");
        }

        assert.ok(world.directories.some(d => `${d._id}` === "script.js.common"));
        assert.ok(world.localDirectories.has("/ws/scripts/common"));
    });

    test("create_directory rejects an existing server directory", async () => {
        const directory: IDirectory = { _id: <ScriptId><unknown>"script.js.common", common: { name: "common" }, relativeUri: fakeUri("/ws/scripts/common"), absoluteUri: fakeUri("/ws/scripts/common") };
        const world = createWorld([], [directory]);

        const outcome = await createDirectory(world.deps, { directoryId: "script.js.common" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }
    });

    test("create_directory rejects an existing local folder", async () => {
        const world = createWorld();
        world.deps.files.directoryExists = () => true;

        const outcome = await createDirectory(world.deps, { directoryId: "script.js", name: "common" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }
    });

    test("create_directory creates missing intermediate directories", async () => {
        const global: IDirectory = { _id: <ScriptId><unknown>"script.js.global", common: { name: "global" }, relativeUri: fakeUri("/ws/scripts/global"), absoluteUri: fakeUri("/ws/scripts/global") };
        const world = createWorld([], [global]);

        const outcome = await createDirectory(world.deps, { directoryId: "script.js.global.07-late-dependencies.devices" });

        assert.strictEqual(outcome.ok, true);
        assert.ok(world.directories.some(d => `${d._id}` === "script.js.global.07-late-dependencies"));
        assert.ok(world.directories.some(d => `${d._id}` === "script.js.global.07-late-dependencies.devices"));
        assert.ok(world.localDirectories.has("/ws/scripts/global/07-late-dependencies/devices"));
    });

    test("create_directory rolls back the server directory when the local folder fails", async () => {
        const world = createWorld();
        world.deps.files.createDirectory = async () => { throw new Error("disk full"); };

        const outcome = await createDirectory(world.deps, { directoryId: "script.js", name: "common" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "server_error");
        }

        assert.ok(!world.directories.some(d => `${d._id}` === "script.js.common"));
    });

    test("create_directory reports an unknown parent when a name is given", async () => {
        const world = createWorld();

        const outcome = await createDirectory(world.deps, { directoryId: "script.js.missing", name: "child" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_found");
        }
    });

    test("create_directory rejects a blank name instead of ignoring it", async () => {
        const world = createWorld();

        const outcome = await createDirectory(world.deps, { directoryId: "script.js.common", name: "  " });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }

        assert.strictEqual(world.directories.length, 0);
    });

    test("create_directory rolls back the local folders it already created", async () => {
        const global: IDirectory = { _id: <ScriptId><unknown>"script.js.global", common: { name: "global" }, relativeUri: fakeUri("/ws/scripts/global"), absoluteUri: fakeUri("/ws/scripts/global") };
        const world = createWorld([], [global]);
        world.deps.files.createDirectory = async (uri: Uri) => {
            if (uri.fsPath === "/ws/scripts/global/07-late-dependencies/devices") {
                throw new Error("disk full");
            }

            world.localDirectories.add(uri.fsPath);
        };

        const outcome = await createDirectory(world.deps, { directoryId: "script.js.global.07-late-dependencies.devices" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "server_error");
        }

        assert.ok(!world.localDirectories.has("/ws/scripts/global/07-late-dependencies"));
        assert.ok(!world.directories.some(d => `${d._id}` === "script.js.global.07-late-dependencies"));
        assert.ok(world.directories.some(d => `${d._id}` === "script.js.global"));
    });

    test("move_script accepts a directory that was created by create_directory", async () => {
        const common: IDirectory = { _id: <ScriptId><unknown>"script.js.common", common: { name: "common" }, relativeUri: fakeUri("/ws/scripts/common"), absoluteUri: fakeUri("/ws/scripts/common") };
        const world = createWorld([localScript("script.js.common.Licht")], [common]);

        const created = await createDirectory(world.deps, { directoryId: "script.js.common", name: "New" });
        assert.strictEqual(created.ok, true);

        const outcome = await moveScript(world.deps, { scriptId: "script.js.common.Licht", targetDirectoryId: "script.js.common.New" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.newScriptId, "script.js.common.New.Licht");
            assert.strictEqual(outcome.data.filePath, "/ws/scripts/moved.js");
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

    test("delete_directory removes an empty server directory and the local folder", async () => {
        const common: IDirectory = { _id: <ScriptId><unknown>"script.js.common", common: { name: "common" }, relativeUri: fakeUri("/ws/scripts/common"), absoluteUri: fakeUri("/ws/scripts/common") };
        const empty: IDirectory = { _id: <ScriptId><unknown>"script.js.common.Empty", common: { name: "Empty" }, relativeUri: fakeUri("/ws/scripts/common/Empty"), absoluteUri: fakeUri("/ws/scripts/common/Empty") };
        const world = createWorld([], [common, empty]);
        world.localDirectories.add(empty.absoluteUri.fsPath);

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js.common.Empty" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.strictEqual(outcome.data.directoryId, "script.js.common.Empty");
            assert.strictEqual(outcome.data.deletedFolderPath, "/ws/scripts/common/Empty");
        }

        assert.ok(!world.directories.some(d => `${d._id}` === "script.js.common.Empty"));
        assert.ok(!world.localDirectories.has(empty.absoluteUri.fsPath));
    });

    test("delete_directory refuses a directory that still contains scripts", async () => {
        const archive: IDirectory = { _id: <ScriptId><unknown>"script.js.common.Archiv", common: { name: "Archiv" }, relativeUri: fakeUri("/ws/scripts/common/Archiv"), absoluteUri: fakeUri("/ws/scripts/common/Archiv") };
        const world = createWorld([localScript("script.js.common.Archiv.Licht")], [archive]);

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js.common.Archiv" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
            assert.ok(outcome.error.message.includes("script.js.common.Archiv.Licht"));
        }

        assert.ok(world.directories.some(d => `${d._id}` === "script.js.common.Archiv"));
    });

    test("delete_directory refuses a directory that still contains subdirectories", async () => {
        const archive: IDirectory = { _id: <ScriptId><unknown>"script.js.common.Archiv", common: { name: "Archiv" }, relativeUri: fakeUri("/ws/scripts/common/Archiv"), absoluteUri: fakeUri("/ws/scripts/common/Archiv") };
        const child: IDirectory = { _id: <ScriptId><unknown>"script.js.common.Archiv.Child", common: { name: "Child" }, relativeUri: fakeUri("/ws/scripts/common/Archiv/Child"), absoluteUri: fakeUri("/ws/scripts/common/Archiv/Child") };
        const world = createWorld([], [archive, child]);

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js.common.Archiv" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
            assert.ok(outcome.error.message.includes("script.js.common.Archiv.Child"));
        }
    });

    test("delete_directory refuses a local folder that still contains files", async () => {
        const archive: IDirectory = { _id: <ScriptId><unknown>"script.js.common.Archiv", common: { name: "Archiv" }, relativeUri: fakeUri("/ws/scripts/common/Archiv"), absoluteUri: fakeUri("/ws/scripts/common/Archiv") };
        const world = createWorld([], [archive]);
        world.localDirectories.add(archive.absoluteUri.fsPath);
        world.localFiles.set(archive.absoluteUri.fsPath, ["stray.txt"]);

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js.common.Archiv" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
            assert.ok(outcome.error.message.includes("stray files") || outcome.error.message.includes("not empty"));
        }

        assert.ok(world.directories.some(d => `${d._id}` === "script.js.common.Archiv"));
    });

    test("delete_directory never deletes the root directory", async () => {
        const world = createWorld();

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "invalid_input");
        }
    });

    test("delete_directory never deletes the common and global directories", async () => {
        const common: IDirectory = { _id: <ScriptId><unknown>"script.js.common", common: { name: "common" }, relativeUri: fakeUri("/ws/scripts/common"), absoluteUri: fakeUri("/ws/scripts/common") };
        const global: IDirectory = { _id: <ScriptId><unknown>"script.js.global", common: { name: "global" }, relativeUri: fakeUri("/ws/scripts/global"), absoluteUri: fakeUri("/ws/scripts/global") };
        const world = createWorld([], [common, global]);

        for (const directoryId of ["script.js.common", "script.js.global"]) {
            const outcome = await deleteDirectory(world.deps, { directoryId: directoryId });

            assert.strictEqual(outcome.ok, false);
            if (!outcome.ok) {
                assert.strictEqual(outcome.error.code, "invalid_input");
            }
        }

        assert.strictEqual(world.directories.length, 2);
    });

    test("delete_directory reports an unknown directory", async () => {
        const world = createWorld();

        const outcome = await deleteDirectory(world.deps, { directoryId: "script.js.missing" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_found");
        }
    });

    test("create_directory followed by delete_directory leaves no trace", async () => {
        const world = createWorld();

        const created = await createDirectory(world.deps, { directoryId: "script.js", name: "temp" });
        assert.strictEqual(created.ok, true);

        const deleted = await deleteDirectory(world.deps, { directoryId: "script.js.temp" });

        assert.strictEqual(deleted.ok, true);
        assert.ok(!world.directories.some(d => `${d._id}` === "script.js.temp"));
        assert.ok(!world.localDirectories.has("/ws/scripts/temp"));
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

    test("get_logs clamps the requested line count", async () => {
        const world = createWorld();
        const requested: number[] = [];
        world.deps.logs.getLogs = async (_hostId: string, lines: number) => {
            requested.push(lines);
            return [];
        };

        await getLogs(world.deps, {});
        await getLogs(world.deps, { lines: 9999 });
        await getLogs(world.deps, { lines: 0 });

        assert.deepStrictEqual(requested, [100, 500, 1]);
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

    test("get_logs reports an unknown host with the available ids", async () => {
        const world = createWorld();
        world.deps.logs.getHosts = async () => [
            { id: "system.host.home", name: "home" },
            { id: "system.host.server", name: "server" }
        ];

        const outcome = await getLogs(world.deps, { hostId: "system.host.unknown" });

        assert.strictEqual(outcome.ok, false);
        if (!outcome.ok) {
            assert.strictEqual(outcome.error.code, "not_found");
            assert.ok(outcome.error.hint?.includes("system.host.home"));
        }
    });

    test("get_logs reads the level from the entry header of colorized logs", async () => {
        const world = createWorld();
        const escape = String.fromCharCode(27);
        const errorLine = `2026-11-07 20:00:01.001 - ${escape}[31merror${escape}[39m: javascript.0 (123) script crashed`;
        const stackTrace = "    at script.js.common.Light:12:3";
        world.deps.logs.getLogs = async () => [
            // an info entry whose message mentions the word error
            "2026-11-07 20:00:00.001 - info: javascript.0 (123) recovered without error",
            errorLine,
            stackTrace
        ];

        const outcome = await getLogs(world.deps, { level: "error" });

        assert.strictEqual(outcome.ok, true);
        if (outcome.ok) {
            assert.deepStrictEqual(outcome.data.entries, [errorLine, stackTrace]);
        }

        const searched = await getLogs(world.deps, { search: "Light:12" });
        assert.strictEqual(searched.ok, true);
        if (searched.ok) {
            assert.deepStrictEqual(searched.data.entries, [errorLine, stackTrace]);
        }
    });

    test("get_logs matches the source filter against the entry source only", async () => {
        const world = createWorld();
        world.deps.logs.getLogs = async () => [
            "2026-11-07 20:00:00.001 - info: admin.0 (1) restarted javascript.0"
        ];

        const mentionedOnly = await getLogs(world.deps, { source: "javascript.0" });
        assert.strictEqual(mentionedOnly.ok, true);
        if (mentionedOnly.ok) {
            assert.deepStrictEqual(mentionedOnly.data.entries, []);
        }

        const actualSource = await getLogs(world.deps, { source: "ADMIN.0" });
        assert.strictEqual(actualSource.ok, true);
        if (actualSource.ok) {
            assert.strictEqual(actualSource.data.entries.length, 1);
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
