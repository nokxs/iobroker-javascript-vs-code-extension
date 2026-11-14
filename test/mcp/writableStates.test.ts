import * as assert from "assert";
import { IoBrokerId } from "../../src/models/IoBrokerId";
import type { IObjectWithId } from "../../src/models/IObject";
import type { IState } from "../../src/models/IState";
import { ServerConfig } from "../../src/mcp/ServerConfig";
import { executeStateWrites, validateStateWrites } from "../../src/aiTools/core/stateAndObjectWrite";
import { listWritableStates } from "../../src/aiTools/core/writableTargets";
import type { StateWriteTarget } from "../../src/aiTools/core/stateAndObjectWrite";
import type { RemoteToolDeps } from "../../src/aiTools/core/remote/types";
import { getWritableStates } from "../../src/aiTools/core/remote/getWritableStates";
import { setStates } from "../../src/aiTools/core/remote/setStates";

const BASE_ENV = { IOBROKER_MCP_URL: "http://host:8081" };

suite("ioBroker id patterns", () => {
    test("* matches across dots and is anchored", () => {
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.Heizung.Temperatur", "0_userdata.0.*"), true);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0", "0_userdata.0.*"), false);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.", "0_userdata.0.*"), true);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.Test", "*"), true);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.Test", "Test"), false);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.Test", "0_userdata.0.T*"), true);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.Test", "0_userdata.0.T*t"), true);
    });

    test("? matches exactly one character and the comparison is case sensitive", () => {
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.A", "0_userdata.0.?"), true);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.AB", "0_userdata.0.?"), false);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.A", "0_userdata.0.a"), false);
        assert.strictEqual(IoBrokerId.matchesPattern("0_userdata.0.A", "0_userdata.0.[A]"), false);
    });

    test("matchesAny answers true for one of several patterns", () => {
        assert.strictEqual(IoBrokerId.matchesAny("alias.0.Test", ["0_userdata.0.*", "alias.0.*"]), true);
        assert.strictEqual(IoBrokerId.matchesAny("javascript.0.Test", ["0_userdata.0.*", "alias.0.*"]), false);
    });

    test("isValid accepts concrete ids only", () => {
        assert.strictEqual(IoBrokerId.isValid("0_userdata.0.Heizung.Temperatur"), true);
        assert.strictEqual(IoBrokerId.isValid(""), false);
        assert.strictEqual(IoBrokerId.isValid("0_userdata.0.Two Words"), false);
        assert.strictEqual(IoBrokerId.isValid("0_userdata.0.*"), false);
        assert.strictEqual(IoBrokerId.isValid("0_userdata.0.Temp?"), false);
        assert.strictEqual(IoBrokerId.isValid("0_userdata..Temperatur"), false);
        assert.strictEqual(IoBrokerId.isValid(".0_userdata.0.Temperatur"), false);
        assert.strictEqual(IoBrokerId.isValid("0_userdata.0.Temperatur."), false);
    });

    test("parentPrefixOf returns the deepest literal subtree", () => {
        assert.strictEqual(IoBrokerId.parentPrefixOf("0_userdata.0.*"), "0_userdata.0");
        assert.strictEqual(IoBrokerId.parentPrefixOf("0_userdata.0.temp*"), "0_userdata.0");
        assert.strictEqual(IoBrokerId.parentPrefixOf("0_userdata.0.temperature"), "0_userdata.0");
        assert.strictEqual(IoBrokerId.parentPrefixOf("0_userdata.*"), "0_userdata");
        assert.strictEqual(IoBrokerId.parentPrefixOf("*"), "");
        assert.strictEqual(IoBrokerId.parentPrefixOf("?abc"), "");
    });
});

suite("writable state allowlist configuration", () => {
    test("parses semicolon separated patterns and ignores empty entries", () => {
        const config = ServerConfig.fromEnvironment({
            ...BASE_ENV,
            IOBROKER_MCP_WRITABLE_STATES: " 0_userdata.0.* ; ;alias.0.Test; "
        });

        assert.deepStrictEqual(config.writableStates, ["0_userdata.0.*", "alias.0.Test"]);
        assert.ok(config.toLogString().includes("writableStates=0_userdata.0.*;alias.0.Test"));
        assert.deepStrictEqual((config.toJSON() as { writableStates: string[] }).writableStates, ["0_userdata.0.*", "alias.0.Test"]);
    });

    test("unset and empty disable writes", () => {
        assert.deepStrictEqual(ServerConfig.fromEnvironment(BASE_ENV).writableStates, []);
        assert.deepStrictEqual(ServerConfig.fromEnvironment({ ...BASE_ENV, IOBROKER_MCP_WRITABLE_STATES: "   " }).writableStates, []);
    });

    test("accepts * alone and explains the risk only at runtime", () => {
        assert.deepStrictEqual(ServerConfig.fromEnvironment({ ...BASE_ENV, IOBROKER_MCP_WRITABLE_STATES: "*" }).writableStates, ["*"]);
    });

    test("rejects a comma, whitespace inside a pattern, too many patterns and long patterns", () => {
        const rejects = (value: string) => {
            assert.throws(
                () => ServerConfig.fromEnvironment({ ...BASE_ENV, IOBROKER_MCP_WRITABLE_STATES: value }),
                (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_WRITABLE_STATES");
        };

        rejects("0_userdata.0.*,alias.0.Test");
        rejects("0_userdata.0.Two Words");
        rejects(Array.from({ length: 51 }, (_, index) => `0_userdata.0.S${index}`).join(";"));
        rejects("a".repeat(513));
    });
});

suite("writable state validation", () => {
    test("normalizes a valid batch and defaults ack to false", () => {
        const result = validateStateWrites({
            states: [
                { stateId: " 0_userdata.0.Temperatur ", value: 21.5 },
                { stateId: "0_userdata.0.Schalter", value: true, ack: true },
                { stateId: "0_userdata.0.Null", value: null }
            ]
        }, ["0_userdata.0.*"]);

        assert.ok(result.ok);
        if (!result.ok) {
            return;
        }

        assert.deepStrictEqual(result.data, [
            { stateId: "0_userdata.0.Temperatur", value: 21.5, ack: false },
            { stateId: "0_userdata.0.Schalter", value: true, ack: true },
            { stateId: "0_userdata.0.Null", value: null, ack: false }
        ]);
    });

    test("an empty allowlist denies the batch", () => {
        const result = validateStateWrites({ states: [{ stateId: "0_userdata.0.Test", value: 1 }] }, []);

        assert.ok(!result.ok);
        if (!result.ok) {
            assert.strictEqual(result.error.code, "not_allowed");
        }
    });

    test("one denied id fails the whole batch and names the patterns", () => {
        const result = validateStateWrites({
            states: [
                { stateId: "0_userdata.0.Test", value: 1 },
                { stateId: "alias.0.Test", value: 2 }
            ]
        }, ["0_userdata.0.*"]);

        assert.ok(!result.ok);
        if (!result.ok) {
            assert.strictEqual(result.error.code, "not_allowed");
            assert.ok(result.error.message.includes("alias.0.Test"));
            assert.ok(result.error.hint?.includes("0_userdata.0.*"));
        }
    });

    test("rejects duplicates, empty or malformed batches, structured values and non finite numbers", () => {
        const invalid = [
            undefined,
            { states: [] },
            { states: Array.from({ length: 51 }, (_, index) => ({ stateId: `0_userdata.0.S${index}`, value: index })) },
            { states: [{ stateId: "0_userdata.0.Test", value: 1 }, { stateId: "0_userdata.0.Test", value: 2 }] },
            { states: [{ stateId: "0_userdata.0.Two Words", value: 1 }] },
            { states: [{ stateId: "0_userdata.0.Test", value: { nested: true } }] },
            { states: [{ stateId: "0_userdata.0.Test", value: [1, 2] }] },
            { states: [{ stateId: "0_userdata.0.Test", value: Number.NaN }] },
            { states: [{ stateId: "0_userdata.0.Test" }] },
            { states: [{ stateId: "0_userdata.0.Test", value: 1, ack: "yes" }] },
            { states: [null] }
        ];

        for (const input of invalid) {
            const result = validateStateWrites(input, ["0_userdata.0.*"]);
            assert.ok(!result.ok, JSON.stringify(input));
            if (!result.ok) {
                assert.strictEqual(result.error.code, "invalid_input", JSON.stringify(input));
            }
        }
    });
});

suite("writable state execution", () => {
    test("writes sequentially, verifies and warns about common.write false", async () => {
        const world = createWriteWorld([
            object("0_userdata.0.Temperatur", { write: true }),
            object("0_userdata.0.Schalter", { write: false })
        ]);
        const entries = validateStateWrites({
            states: [
                { stateId: "0_userdata.0.Temperatur", value: 21.5 },
                { stateId: "0_userdata.0.Schalter", value: true, ack: true }
            ]
        }, ["0_userdata.0.*"]);

        assert.ok(entries.ok);
        if (!entries.ok) {
            return;
        }

        const result = await executeStateWrites(world.states, entries.data);

        assert.deepStrictEqual(world.writes.map(write => write.id), ["0_userdata.0.Temperatur", "0_userdata.0.Schalter"]);
        assert.deepStrictEqual(result.written.map(entry => entry.verified), [true, true]);
        assert.strictEqual(result.written[0].warning, undefined);
        assert.ok(result.written[1].warning?.includes("common.write"));
        assert.deepStrictEqual(result.failed, []);
        assert.deepStrictEqual(result.notAttempted, []);
    });

    test("reports a missing or non state object per entry and continues", async () => {
        const world = createWriteWorld([
            object("0_userdata.0.Channel", { type: "channel" }),
            object("0_userdata.0.Ok", { write: true })
        ]);

        const result = await executeStateWrites(world.states, [
            { stateId: "0_userdata.0.Missing", value: 1, ack: false },
            { stateId: "0_userdata.0.Channel", value: 1, ack: false },
            { stateId: "0_userdata.0.Ok", value: 1, ack: false }
        ]);

        assert.deepStrictEqual(result.failed.map(entry => entry.code), ["not_found", "invalid_input"]);
        assert.deepStrictEqual(result.written.map(entry => entry.id), ["0_userdata.0.Ok"]);
        assert.deepStrictEqual(world.writes.map(write => write.id), ["0_userdata.0.Ok"]);
    });

    test("stops on a socket error and reports the rest as notAttempted", async () => {
        const world = createWriteWorld([
            object("0_userdata.0.A", { write: true }),
            object("0_userdata.0.B", { write: true }),
            object("0_userdata.0.C", { write: true })
        ], "0_userdata.0.B");

        const result = await executeStateWrites(world.states, [
            { stateId: "0_userdata.0.A", value: 1, ack: false },
            { stateId: "0_userdata.0.B", value: 2, ack: false },
            { stateId: "0_userdata.0.C", value: 3, ack: false }
        ]);

        assert.deepStrictEqual(result.written.map(entry => entry.id), ["0_userdata.0.A"]);
        assert.deepStrictEqual(result.failed.map(entry => entry.id), ["0_userdata.0.B"]);
        assert.deepStrictEqual(result.notAttempted, ["0_userdata.0.C"]);
        assert.deepStrictEqual(world.writes.map(write => write.id), ["0_userdata.0.A"]);
    });

    test("a failed re-read keeps the write successful but unverified", async () => {
        const world = createWriteWorld([object("0_userdata.0.A", { write: true })]);
        world.states.getState = async () => {
            throw new Error("Admin 4 has no getState");
        };

        const result = await executeStateWrites(world.states, [{ stateId: "0_userdata.0.A", value: 1, ack: false }]);

        assert.strictEqual(result.written.length, 1);
        assert.strictEqual(result.written[0].verified, false);
        assert.deepStrictEqual(result.failed, []);
    });
});

suite("writable state discovery", () => {    test("expands the allowlist, dedupes prefixes and filters by pattern and search", async () => {
        const queried: string[] = [];
        const states = {
            getObjectsOfType: async (_type: string, prefix: string) => {
                queried.push(prefix);
                return [
                    object("0_userdata.0.Heizung.Temperatur", { name: "Temperatur" }),
                    object("0_userdata.0.Heizung.Schalter", { name: "Schalter" }),
                    object("alias.0.Test", { name: "Alias Test" }),
                    object("0_userdata.0.Andere.Temperatur", { name: "Temperatur" })
                ].filter(candidate => prefix.length === 0 || candidate._id.startsWith(`${prefix}.`));
            }
        };

        const result = await listWritableStates(states, ["0_userdata.0.*", "0_userdata.0.Heizung.*"], { search: "temp" });

        assert.ok(result.ok);
        if (!result.ok) {
            return;
        }

        assert.deepStrictEqual(queried, ["0_userdata.0", "0_userdata.0.Heizung"]);
        assert.deepStrictEqual(result.data.states.map(state => state.id), [
            "0_userdata.0.Andere.Temperatur",
            "0_userdata.0.Heizung.Temperatur"
        ]);
        assert.deepStrictEqual(result.data.patterns, ["0_userdata.0.*", "0_userdata.0.Heizung.*"]);
        assert.strictEqual(result.data.truncated, false);
    });

    test("marks a limited result as truncated and exposes the writable flag", async () => {
        const states = {
            getObjectsOfType: async () => [
                object("0_userdata.0.B", { write: false }),
                object("0_userdata.0.A", { write: true })
            ]
        };

        const result = await listWritableStates(states, ["0_userdata.0.*"], { limit: 1 });

        assert.ok(result.ok);
        if (!result.ok) {
            return;
        }

        assert.deepStrictEqual(result.data.states.map(state => state.id), ["0_userdata.0.A"]);
        assert.strictEqual(result.data.states[0].writable, true);
        assert.strictEqual(result.data.truncated, true);
    });

    test("an empty allowlist answers without touching ioBroker", async () => {
        let calls = 0;
        const result = await listWritableStates({
            getObjectsOfType: async () => {
                calls++;
                return [];
            }
        }, [], {});

        assert.ok(result.ok);
        assert.strictEqual(calls, 0);
        if (result.ok) {
            assert.deepStrictEqual(result.data, { patterns: [], states: [], truncated: false });
        }
    });
});

suite("writable state remote wrappers", () => {
    test("set_states validates the allowlist before it needs a connection", async () => {
        const deps = fakeDeps(false, []);

        const result = await setStates(deps, { states: [{ stateId: "0_userdata.0.Test", value: 1 }] });

        assert.ok(!result.ok);
        if (!result.ok) {
            assert.strictEqual(result.error.code, "not_allowed");
        }
    });

    test("set_states reports not_connected after a valid batch and discovery needs the connection only with patterns", async () => {
        const withoutAllowlist = fakeDeps(false, []);
        const discovery = await getWritableStates(withoutAllowlist, {});
        assert.ok(discovery.ok);
        if (discovery.ok) {
            assert.deepStrictEqual(discovery.data, { patterns: [], states: [], truncated: false });
        }

        const withAllowlist = fakeDeps(false, ["0_userdata.0.*"]);
        const write = await setStates(withAllowlist, { states: [{ stateId: "0_userdata.0.Test", value: 1 }] });
        assert.ok(!write.ok);
        if (!write.ok) {
            assert.strictEqual(write.error.code, "not_connected");
        }

        const writable = await getWritableStates(withAllowlist, {});
        assert.ok(!writable.ok);
        if (!writable.ok) {
            assert.strictEqual(writable.error.code, "not_connected");
        }
    });
});

interface WriteWorld {
    states: StateWriteTarget
    writes: Array<{ id: string, state: Pick<IState, "val" | "ack"> }>
}

function object(id: string, options: { name?: string, type?: string, write?: boolean } = {}): IObjectWithId {
    return {
        _id: id,
        type: options.type ?? "state",
        common: {
            name: options.name ?? id,
            write: options.write ?? true
        }
    };
}

function fakeDeps(connected: boolean, writableStates: readonly string[]): RemoteToolDeps {
    return <RemoteToolDeps><unknown>{
        connection: { isConnected: () => connected },
        writableStates: writableStates,
        states: {
            getObject: async () => null,
            setState: async () => undefined,
            getState: async () => <IState><unknown>null,
            getObjectsOfType: async () => []
        }
    };
}

function createWriteWorld(objects: IObjectWithId[], failSetFor?: string): WriteWorld {    const values = new Map<string, IState>();
    const writes: Array<{ id: string, state: Pick<IState, "val" | "ack"> }> = [];

    return {
        writes: writes,
        states: {
            getObject: async (id: string) => objects.find(candidate => candidate._id === id) ?? null,
            setState: async (id: string, state: Pick<IState, "val" | "ack">) => {
                if (id === failSetFor) {
                    throw new Error("The socket acknowledgement timed out.");
                }

                writes.push({ id: id, state: state });
                values.set(id, <IState>{ val: state.val, ack: state.ack, ts: 1, lc: 1, from: "test" });
            },
            getState: async (id: string) => values.get(id) ?? <IState><unknown>null
        }
    };
}
