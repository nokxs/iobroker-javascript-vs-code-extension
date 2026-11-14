import * as assert from "assert";
import { EngineType } from "../../models/EngineType";
import { IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { RemoteDirectory, RemoteScriptRepository } from "../../services/remote/RemoteScriptRepository";
import { IJsInstance } from "../../models/IJsInstance";
import { IObjectWithId } from "../../models/IObject";
import { IState } from "../../models/IState";
import { getObjects } from "../../aiTools/core/remote/getObjects";
import { getState } from "../../aiTools/core/remote/getState";
import { getStates } from "../../aiTools/core/remote/getStates";
import { RemoteToolDeps, MAX_SCRIPT_SOURCE_LENGTH } from "../../aiTools/core/remote/types";
import { createDirectory } from "../../aiTools/core/remote/createDirectory";
import { createScript } from "../../aiTools/core/remote/createScript";
import { deleteDirectory } from "../../aiTools/core/remote/deleteDirectory";
import { deleteScript } from "../../aiTools/core/remote/deleteScript";
import { getScriptContent } from "../../aiTools/core/remote/getScriptContent";
import { getScripts } from "../../aiTools/core/remote/getScripts";
import { moveScript } from "../../aiTools/core/remote/moveScript";
import { renameScript } from "../../aiTools/core/remote/renameScript";
import { startScript, stopScript } from "../../aiTools/core/remote/startStopScript";
import { updateScriptSource } from "../../aiTools/core/remote/updateScriptSource";

interface RemoteWorld {
    deps: RemoteToolDeps
    scripts: IScript[]
    directories: RemoteDirectory[]
    objects: IObjectWithId[]
    stateValues: Map<string, IState>
    writes: Array<{ id: string, state: Pick<IState, "val" | "ack"> }>
    uploaded: IScript[]
    updated: IScript[]
    renamed: Array<{ id: string, name: string }>
    moved: Array<{ id: string, target: string }>
    deleted: string[]
    createdDirectories: string[]
    deletedDirectories: string[]
    connected: boolean
}

function script(id: string, source = "", enabled = false): IScript {
    return {
        _id: new ScriptId(id),
        type: "script",
        common: {
            name: ScriptId.lastSegmentOf(id),
            engineType: "javascript/js",
            source: source,
            enabled: enabled
        }
    };
}

function tick(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 1));
}

function requireScript(world: RemoteWorld, id: ScriptId): IScript {
    const script = world.scripts.find(candidate => `${candidate._id}` === `${id}`);
    if (!script) {
        throw new Error(`The script '${id}' is not known to the fake server.`);
    }

    return script;
}

function directory(id: string): RemoteDirectory {
    return { _id: new ScriptId(id), common: { name: ScriptId.lastSegmentOf(id) } };
}

function stateObject(id: string, type: string, role: string | undefined, name: string, unit?: string): IObjectWithId {
    return { _id: id, type: type, common: { name: name, role: role, unit: unit } };
}

async function createWorld(scripts: IScript[] = [], directories: RemoteDirectory[] = [], objects: IObjectWithId[] = []): Promise<RemoteWorld> {
    const world: RemoteWorld = {
        deps: <RemoteToolDeps><unknown>{},
        scripts: scripts,
        directories: directories,
        objects: objects,
        stateValues: new Map<string, IState>(),
        writes: [],
        uploaded: [],
        updated: [],
        renamed: [],
        moved: [],
        deleted: [],
        createdDirectories: [],
        deletedDirectories: [],
        connected: true
    };

    const repository = new RemoteScriptRepository({
        scriptRemote: {
            downloadAllScripts: async () => world.scripts,
            downloadScriptWithId: async (id: ScriptId) => <IScript><unknown>world.scripts.find(candidate => `${candidate._id}` === `${id}`) ?? null,
            registerScriptChangedEventListener: () => undefined
        },
        directories: {
            downloadAllDirectories: async () => <IDirectory[]><unknown>world.directories,
            downloadDirectory: async (id: ScriptId) => <IDirectory><unknown>world.directories.find(candidate => `${candidate._id}` === `${id}`) ?? null
        }
    });
    await repository.updateFromServer();

    world.deps = {
        connection: { isConnected: () => world.connected },
        scripts: repository,
        scriptRemote: {
            downloadScriptWithId: async (id: ScriptId) => <IScript><unknown>world.scripts.find(candidate => `${candidate._id}` === `${id}`) ?? null,
            uploadScript: async (value: IScript) => {
                world.uploaded.push(value);
                world.scripts = world.scripts.filter(candidate => `${candidate._id}` !== `${value._id}`);
                world.scripts.push(value);
            },
            update: async (id: ScriptId, value: IScript) => {
                world.updated.push(value);
                const existing = world.scripts.find(candidate => `${candidate._id}` === `${id}`);
                if (existing) {
                    existing.common.source = value.common.source;
                }
            },
            startScript: async (id: ScriptId) => {
                await tick();
                const existing = requireScript(world, id);
                existing.common.enabled = true;
            },
            stopScript: async (id: ScriptId) => {
                await tick();
                const existing = requireScript(world, id);
                existing.common.enabled = false;
            },
            rename: async (id: ScriptId, name: string) => {
                world.renamed.push({ id: `${id}`, name: name });
                const existing = world.scripts.find(candidate => `${candidate._id}` === `${id}`);
                if (existing) {
                    const newId = `${ScriptId.parentIdOf(`${id}`)}.${name}`;
                    world.scripts = world.scripts.filter(candidate => `${candidate._id}` !== `${id}`);
                    existing._id = new ScriptId(newId);
                    existing.common.name = name;
                    world.scripts.push(existing);
                }
            },
            move: async (id: ScriptId, target: RemoteDirectory) => {
                world.moved.push({ id: `${id}`, target: `${target._id}` });
                const existing = world.scripts.find(candidate => `${candidate._id}` === `${id}`);
                if (existing) {
                    const newId = `${target._id}.${ScriptId.lastSegmentOf(`${id}`)}`;
                    world.scripts = world.scripts.filter(candidate => `${candidate._id}` !== `${id}`);
                    existing._id = new ScriptId(newId);
                    world.scripts.push(existing);
                }
            },
            delete: async (id: ScriptId) => {
                world.deleted.push(`${id}`);
                world.scripts = world.scripts.filter(candidate => `${candidate._id}` !== `${id}`);
            }
        },
        directories: {
            createDirectory: async () => undefined,
            createDirectoriesRecursively: async (id: ScriptId) => {
                const parts = `${id}`.split(".");
                for (let count = 3; count <= parts.length; count++) {
                    const directoryId = parts.slice(0, count).join(".");
                    if (!world.directories.some(candidate => `${candidate._id}` === directoryId)) {
                        world.createdDirectories.push(directoryId);
                        world.directories.push(directory(directoryId));
                    }
                }
            },
            downloadDirectory: async (id: ScriptId) => <IDirectory><unknown>world.directories.find(candidate => `${candidate._id}` === `${id}`) ?? null,
            deleteDirectory: async (id: ScriptId) => {
                world.deletedDirectories.push(`${id}`);
                world.directories = world.directories.filter(candidate => `${candidate._id}` !== `${id}`);
            }
        },
        jsInstances: { getAvailableInstances: async () => <IJsInstance[]>[{ _id: "system.adapter.javascript.0" }] },
        states: {
            getState: async (id: string) => world.stateValues.get(id) ?? <never><unknown>undefined,
            getObjectsOfType: async (type: string, parentId: string) => world.objects.filter(object =>
                (object.type ?? "state") === type &&
                (parentId.length === 0 || object._id.startsWith(`${parentId}.`))),
            getObject: async (id: string) => world.objects.find(object => object._id === id) ?? null,
            setState: async (id: string, state: Pick<IState, "val" | "ack">) => {
                world.writes.push({ id: id, state: state });
                world.stateValues.set(id, <IState>{ val: state.val, ack: state.ack, ts: Date.now(), lc: Date.now(), from: "test" });
            }
        },
        writableStates: [],
        logs: { getHosts: async () => [], getLogs: async () => [] }
    };

    return world;
}

suite("AI tools remote core", () => {
    test("getScripts lists the cached scripts without local file fields", async () => {
        const world = await createWorld(
            [script("script.js.common.A"), script("script.js.common.B"), script("script.js.global.C")],
            [directory("script.js.common"), directory("script.js.global")]);

        const result = await getScripts(world.deps, {});
        assert.ok(result.ok);
        assert.strictEqual(result.data.scripts.length, 3);
        assert.strictEqual(result.data.truncated, false);
        assert.deepStrictEqual(Object.keys(result.data.scripts[0]).sort(), ["enabled", "engineType", "name", "scriptId"]);

        const filtered = await getScripts(world.deps, { pathPrefix: "script.js.common", limit: 1 });
        assert.ok(filtered.ok);
        assert.strictEqual(filtered.data.scripts.length, 1);
        assert.strictEqual(filtered.data.truncated, true);
    });

    test("getScripts answers not_connected without ioBroker", async () => {
        const world = await createWorld();
        world.connected = false;

        const result = await getScripts(world.deps, {});
        assert.ok(!result.ok);
        assert.strictEqual(result.error.code, "not_connected");
    });

    test("getScriptContent reads the server source and truncates", async () => {
        const world = await createWorld([script("script.js.common.A", "0123456789")]);

        const result = await getScriptContent(world.deps, { scriptId: "script.js.common.A", maxLength: 4 });
        assert.ok(result.ok);
        assert.strictEqual(result.data.source, "0123");
        assert.strictEqual(result.data.truncated, true);
        assert.ok(!("fromDisk" in result.data));

        const missing = await getScriptContent(world.deps, { scriptId: "script.js.common.Missing" });
        assert.ok(!missing.ok);
        assert.strictEqual(missing.error.code, "not_found");
    });

    test("createScript uploads a script with its source", async () => {
        const world = await createWorld([], [directory("script.js.common")]);

        const result = await createScript(world.deps, {
            directoryId: "script.js.common",
            fileName: "Neu",
            language: "javascript",
            source: "log('hi');"
        });

        assert.ok(result.ok);
        assert.strictEqual(result.data.scriptId, "script.js.common.Neu");
        assert.strictEqual(world.uploaded.length, 1);
        assert.strictEqual(world.uploaded[0].common.source, "log('hi');");
        assert.strictEqual(world.uploaded[0].common.engineType, EngineType.javascript);

        const duplicate = await createScript(world.deps, {
            directoryId: "script.js.common",
            fileName: "Neu",
            language: "javascript"
        });
        assert.ok(!duplicate.ok);
        assert.strictEqual(duplicate.error.code, "already_exists");
    });

    test("updateScriptSource writes common.source and caps the size", async () => {
        const world = await createWorld([script("script.js.common.A", "old")]);

        const result = await updateScriptSource(world.deps, { scriptId: "script.js.common.A", source: "new" });
        assert.ok(result.ok);
        assert.strictEqual(result.data.characters, 3);
        assert.strictEqual(world.updated[0].common.source, "new");

        const tooLong = await updateScriptSource(world.deps, {
            scriptId: "script.js.common.A",
            source: "x".repeat(MAX_SCRIPT_SOURCE_LENGTH + 1)
        });
        assert.ok(!tooLong.ok);
        assert.strictEqual(tooLong.error.code, "invalid_input");
    });

    test("renameScript and moveScript return the new id", async () => {
        const world = await createWorld(
            [script("script.js.common.Alt"), script("script.js.other.X")],
            [directory("script.js.common"), directory("script.js.other")]);

        const renamed = await renameScript(world.deps, { scriptId: "script.js.common.Alt", newName: "Neu" });
        assert.ok(renamed.ok);
        assert.strictEqual(renamed.data.newScriptId, "script.js.common.Neu");
        assert.deepStrictEqual(world.renamed, [{ id: "script.js.common.Alt", name: "Neu" }]);

        const moved = await moveScript(world.deps, { scriptId: "script.js.common.Neu", targetDirectoryId: "script.js.other" });
        assert.ok(moved.ok);
        assert.strictEqual(moved.data.newScriptId, "script.js.other.Neu");
        assert.deepStrictEqual(world.moved, [{ id: "script.js.common.Neu", target: "script.js.other" }]);
    });

    test("createDirectory creates missing parents and rejects existing directories", async () => {
        const world = await createWorld([], [directory("script.js.common")]);

        const result = await createDirectory(world.deps, { directoryId: "script.js.common.Folder.Deep" });
        assert.ok(result.ok);
        assert.strictEqual(result.data.directoryId, "script.js.common.Folder.Deep");
        assert.deepStrictEqual(world.createdDirectories, ["script.js.common.Folder", "script.js.common.Folder.Deep"]);

        const existing = await createDirectory(world.deps, { directoryId: "script.js.common" });
        assert.ok(!existing.ok);
        assert.strictEqual(existing.error.code, "invalid_input");
    });

    test("deleteDirectory refuses a non empty directory and deletes an empty one", async () => {
        const world = await createWorld(
            [script("script.js.common.Full.Inner")],
            [directory("script.js.common.Full"), directory("script.js.common.Empty")]);

        const nonEmpty = await deleteDirectory(world.deps, { directoryId: "script.js.common.Full" });
        assert.ok(!nonEmpty.ok);
        assert.strictEqual(nonEmpty.error.code, "invalid_input");

        const empty = await deleteDirectory(world.deps, { directoryId: "script.js.common.Empty" });
        assert.ok(empty.ok);
        assert.deepStrictEqual(world.deletedDirectories, ["script.js.common.Empty"]);
    });

    test("deleteScript and start/stop mirror the extension behaviour", async () => {
        const world = await createWorld([script("script.js.common.A", "", false), script("script.js.common.B")]);

        const started = await startScript(world.deps, { scriptId: "script.js.common.A" });
        assert.ok(started.ok);
        assert.strictEqual(started.data.enabled, true);
        // The write has to be awaited, otherwise the state is not on the server yet.
        assert.strictEqual(requireScript(world, new ScriptId("script.js.common.A")).common.enabled, true);

        const stopped = await stopScript(world.deps, { scriptId: "script.js.common.B" });
        assert.ok(stopped.ok);
        assert.strictEqual(stopped.data.enabled, false);
        assert.strictEqual(requireScript(world, new ScriptId("script.js.common.B")).common.enabled, false);

        const deleted = await deleteScript(world.deps, { scriptId: "script.js.common.A" });
        assert.ok(deleted.ok);
        assert.deepStrictEqual(world.deleted, ["script.js.common.A"]);
    });

    test("a failing start/stop write is a tool error, not an unhandled rejection", async () => {
        const world = await createWorld([script("script.js.common.A")]);
        world.deps.scriptRemote.startScript = async () => {
            throw new Error("The socket is closed.");
        };

        const result = await startScript(world.deps, { scriptId: "script.js.common.A" });
        assert.ok(!result.ok);
        assert.strictEqual(result.error.code, "server_error");
        assert.ok(result.error.message.includes("socket is closed"));
    });

    test("createScript refuses an id that only the server knows", async () => {
        const world = await createWorld([], [directory("script.js.common")]);
        // The cache does not contain the script, the server does.
        world.scripts.push(script("script.js.common.Neu"));

        const result = await createScript(world.deps, {
            directoryId: "script.js.common",
            fileName: "Neu",
            language: "javascript"
        });

        assert.ok(!result.ok);
        assert.strictEqual(result.error.code, "already_exists");
        assert.deepStrictEqual(world.uploaded, []);
    });

    test("createScript uses an existing javascript instance as engine", async () => {
        const world = await createWorld([], [directory("script.js.common")]);
        world.deps.jsInstances = {
            getAvailableInstances: async () => <IJsInstance[]>[{ _id: "system.adapter.javascript.2" }]
        };

        const result = await createScript(world.deps, {
            directoryId: "script.js.common",
            fileName: "Neu",
            language: "javascript"
        });

        assert.ok(result.ok);
        assert.strictEqual(world.uploaded[0].common.engine, "system.adapter.javascript.2");
    });

    test("createDirectory rolls back the directories a failed creation left behind", async () => {
        const world = await createWorld([], [directory("script.js.common")]);
        world.deps.directories.createDirectoriesRecursively = async (id: ScriptId) => {
            // The first level is created, then the socket drops.
            world.directories.push(directory("script.js.common.Folder"));
            throw new Error(`Could not create '${id}'.`);
        };

        const result = await createDirectory(world.deps, { directoryId: "script.js.common.Folder.Deep" });

        assert.ok(!result.ok);
        assert.strictEqual(result.error.code, "server_error");
        assert.deepStrictEqual(world.deletedDirectories, ["script.js.common.Folder"]);
        assert.ok(!world.directories.some(candidate => `${candidate._id}` === "script.js.common.Folder"));
    });

    test("createDirectory does not roll back when nothing was created", async () => {
        const world = await createWorld([], [directory("script.js.common")]);
        world.deps.directories.createDirectoriesRecursively = async () => {
            throw new Error("The connection is closed.");
        };

        const result = await createDirectory(world.deps, { directoryId: "script.js.common.Folder" });

        assert.ok(!result.ok);
        assert.deepStrictEqual(world.deletedDirectories, []);
    });

    test("getState reports not_found for an unknown id instead of a server error", async () => {
        const world = await createWorld();
        world.deps.states = {
            getState: async () => <IState><unknown>null,
            getObjectsOfType: async () => [],
            getObject: async () => null,
            setState: async () => undefined
        };

        const result = await getState(world.deps, { stateId: "0_userdata.0.Missing" });

        assert.ok(!result.ok);
        assert.strictEqual(result.error.code, "not_found");
    });

    test("getStates reads several states in the given order and reports missing ids", async () => {
        const world = await createWorld();
        const known = new Map<string, IState>([
            ["0_userdata.0.A", <IState><unknown>{ val: 21.5, ack: true, ts: 1000, lc: 900, from: "system.adapter.javascript.0" }],
            ["0_userdata.0.B", <IState><unknown>{ val: false, ack: false, ts: 2000, lc: 2000, from: "system.adapter.javascript.1" }]
        ]);
        world.deps.states = {
            getState: async (id: string) => known.get(id) ?? <IState><unknown>null,
            getObjectsOfType: async () => [],
            getObject: async () => null,
            setState: async () => undefined
        };

        const result = await getStates(world.deps, {
            stateIds: ["0_userdata.0.A", "0_userdata.0.Missing", "0_userdata.0.B", "0_userdata.0.A"]
        });

        assert.ok(result.ok);
        if (!result.ok) {
            return;
        }

        assert.deepStrictEqual(result.data.states.map(state => state.id), ["0_userdata.0.A", "0_userdata.0.B"]);
        assert.strictEqual(result.data.states[0].value, 21.5);
        assert.strictEqual(result.data.states[1].acknowledged, false);
        assert.deepStrictEqual(result.data.missing, ["0_userdata.0.Missing"]);
    });

    test("getStates rejects more than 50 ids and empty arrays", async () => {
        const world = await createWorld();
        const tooMany = Array.from({ length: 51 }, (_, index) => `0_userdata.0.S${index}`);

        const tooManyResult = await getStates(world.deps, { stateIds: tooMany });
        const emptyResult = await getStates(world.deps, { stateIds: [] });

        assert.ok(!tooManyResult.ok);
        assert.strictEqual(tooManyResult.error.code, "invalid_input");
        assert.ok(!emptyResult.ok);
        assert.strictEqual(emptyResult.error.code, "invalid_input");
    });

    test("getObjects lists the subtree, filters by role and reads values on request", async () => {
        const world = await createWorld([], [], [
            stateObject("0_userdata.0.Heizung.Temperatur", "state", "value.temperature", "Temperatur", "°C"),
            stateObject("0_userdata.0.Heizung.Schalter", "state", "switch", "Schalter"),
            stateObject("0_userdata.0.Heizung", "channel", undefined, "Heizung"),
            stateObject("0_userdata.0.Andere.Temperatur", "state", "value.temperature", "Temperatur", "°C")
        ]);
        world.deps.states = {
            getState: async (id: string) => <IState><unknown>{ val: 21.5, ack: true, ts: 1000, lc: 900, from: "system.adapter.javascript.0", id: id },
            getObjectsOfType: async (type: string, parentId: string) => world.objects.filter(object =>
                (object.type ?? "state") === type &&
                (parentId.length === 0 || object._id.startsWith(`${parentId}.`))),
            getObject: async (id: string) => world.objects.find(object => object._id === id) ?? null,
            setState: async () => undefined
        };

        const subtree = await getObjects(world.deps, { parentId: "0_userdata.0.Heizung", withValues: true });
        const byRole = await getObjects(world.deps, { parentId: "0_userdata.0", role: "value.temperature" });
        const bySearch = await getObjects(world.deps, { search: "heizung" });

        assert.ok(subtree.ok);
        if (!subtree.ok) {
            return;
        }

        assert.deepStrictEqual(subtree.data.objects.map(object => object.id), [
            "0_userdata.0.Heizung.Schalter",
            "0_userdata.0.Heizung.Temperatur"
        ]);
        assert.strictEqual(subtree.data.objects[1].unit, "°C");
        assert.strictEqual(subtree.data.objects[1].value, 21.5);
        assert.strictEqual(subtree.data.objects[0].value, 21.5);

        assert.ok(byRole.ok);
        if (!byRole.ok) {
            return;
        }

        assert.deepStrictEqual(byRole.data.objects.map(object => object.id), [
            "0_userdata.0.Andere.Temperatur",
            "0_userdata.0.Heizung.Temperatur"
        ]);
        assert.strictEqual(byRole.data.objects[0].value, undefined);

        assert.ok(bySearch.ok);
        if (!bySearch.ok) {
            return;
        }

        assert.deepStrictEqual(bySearch.data.objects.map(object => object.id), [
            "0_userdata.0.Heizung",
            "0_userdata.0.Heizung.Schalter",
            "0_userdata.0.Heizung.Temperatur"
        ]);
        assert.strictEqual(bySearch.data.parentId, null);
    });

    test("getObjects marks a limited list as truncated and refuses an unfiltered full browse", async () => {
        const world = await createWorld([], [], [
            stateObject("0_userdata.0.A", "state", "switch", "A"),
            stateObject("0_userdata.0.B", "state", "switch", "B")
        ]);

        const limited = await getObjects(world.deps, { parentId: "0_userdata.0", limit: 1 });
        const unfiltered = await getObjects(world.deps, {});

        assert.ok(limited.ok);
        if (!limited.ok) {
            return;
        }

        assert.strictEqual(limited.data.objects.length, 1);
        assert.strictEqual(limited.data.truncated, true);

        assert.ok(!unfiltered.ok);
        assert.strictEqual(unfiltered.error.code, "invalid_input");
    });
});
