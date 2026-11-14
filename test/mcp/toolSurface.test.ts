import * as assert from "assert";
import { TOOL_NAMES, TOOL_DESCRIPTIONS, TOOL_TITLES } from "../../src/aiTools/schemas";
import {
    getRemoteToolHandler,
    isReadOnlyTool,
    isRemoteToolName,
    listRemoteTools,
    REMOTE_TOOL_NAMES,
    GET_WRITABLE_STATES_TOOL,
    SET_STATES_TOOL,
    UPDATE_SCRIPT_SOURCE_TOOL
} from "../../src/mcp/tools/remoteToolSet";

suite("MCP tool surface", () => {
    test("the server implements the 18 remote tools exactly once", () => {
        assert.strictEqual(REMOTE_TOOL_NAMES.length, 18);
        assert.strictEqual(new Set(REMOTE_TOOL_NAMES).size, REMOTE_TOOL_NAMES.length);

        for (const name of REMOTE_TOOL_NAMES) {
            assert.ok(isRemoteToolName(name), name);
            assert.strictEqual(typeof getRemoteToolHandler(name), "function", name);
        }

        assert.ok(REMOTE_TOOL_NAMES.includes(UPDATE_SCRIPT_SOURCE_TOOL));
        assert.ok(REMOTE_TOOL_NAMES.includes(GET_WRITABLE_STATES_TOOL));
        assert.ok(REMOTE_TOOL_NAMES.includes(SET_STATES_TOOL));
    });

    test("every advertised tool is either a contributed tool or a remote-only tool", () => {
        for (const name of REMOTE_TOOL_NAMES) {
            if (name === UPDATE_SCRIPT_SOURCE_TOOL || name === GET_WRITABLE_STATES_TOOL || name === SET_STATES_TOOL) {
                continue;
            }

            assert.ok((TOOL_NAMES as string[]).includes(name), `${name} is not contributed`);
        }

        // The four sync tools describe a local/remote difference and are dropped.
        for (const dropped of ["iobroker_upload_script", "iobroker_upload_all_changed_scripts", "iobroker_download_script", "iobroker_get_changed_scripts"]) {
            assert.ok(!(REMOTE_TOOL_NAMES as readonly string[]).includes(dropped), `${dropped} must not be advertised`);
        }
    });

    test("tools/list hides set_states without an allowlist but keeps the discovery tool", () => {
        const withoutAllowlist = listRemoteTools(false);
        assert.strictEqual(withoutAllowlist.length, 17);
        assert.ok(withoutAllowlist.some(tool => tool.name === GET_WRITABLE_STATES_TOOL));
        assert.ok(!withoutAllowlist.some(tool => tool.name === SET_STATES_TOOL));

        const withAllowlist = listRemoteTools(false, true);
        assert.strictEqual(withAllowlist.length, 18);
        assert.ok(withAllowlist.some(tool => tool.name === SET_STATES_TOOL));
    });

    test("tools/list is filtered by the read-only switch", () => {
        const readOnly = listRemoteTools(true, true);
        assert.deepStrictEqual(readOnly.map(tool => tool.name).sort(), [
            "iobroker_get_js_instances",
            "iobroker_get_logs",
            "iobroker_get_objects",
            "iobroker_get_script_content",
            "iobroker_get_scripts",
            "iobroker_get_state",
            "iobroker_get_states",
            "iobroker_get_writable_states"
        ]);
        assert.strictEqual(readOnly.length, 8);

        for (const name of REMOTE_TOOL_NAMES) {
            assert.strictEqual(isReadOnlyTool(name), readOnly.some(tool => tool.name === name), name);
        }
    });

    test("every tool sets all annotations explicitly", () => {
        for (const tool of listRemoteTools(false, true)) {
            const annotations = tool.annotations;
            assert.ok(annotations, tool.name);
            assert.strictEqual(typeof annotations.readOnlyHint, "boolean", tool.name);
            assert.strictEqual(annotations.openWorldHint, false, tool.name);
            assert.strictEqual(typeof annotations.idempotentHint, "boolean", tool.name);

            if (annotations.readOnlyHint !== true) {
                assert.strictEqual(typeof annotations.destructiveHint, "boolean", tool.name);
            }
        }
    });

    test("start/stop are writes but idempotent, renames, moves, state writes and source updates are destructive", () => {
        const byName = new Map(listRemoteTools(false, true).map(tool => [tool.name, tool]));

        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.readOnlyHint, false);
        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.idempotentHint, true);
        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.destructiveHint, false);

        assert.strictEqual(byName.get("iobroker_rename_script")?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get("iobroker_move_script")?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get(UPDATE_SCRIPT_SOURCE_TOOL)?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get(SET_STATES_TOOL)?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get(SET_STATES_TOOL)?.annotations?.idempotentHint, true);
        assert.strictEqual(byName.get(GET_WRITABLE_STATES_TOOL)?.annotations?.readOnlyHint, true);
    });

    test("every tool has a title, a description and an input schema", () => {
        for (const tool of listRemoteTools(false, true)) {
            assert.ok(tool.title && tool.title.length > 0, tool.name);
            assert.ok(tool.description && tool.description.length > 40, tool.name);
            assert.strictEqual(tool.inputSchema.type, "object", tool.name);
        }
    });

    test("the descriptions do not promise a local file", () => {
        // The server has no workspace, no local script file and no dirty state. A description that
        // mentions them makes a model look for fields that the tool does not return.
        for (const tool of listRemoteTools(false, true)) {
            const text = `${tool.title ?? ""} ${tool.description ?? ""}`.toLowerCase();
            for (const forbidden of ["local file", "local folder", "fromdisk", "on disk", "workspace", "unsaved"]) {
                assert.ok(!text.includes(forbidden), `${tool.name} mentions '${forbidden}': ${tool.description}`);
            }
        }
    });

    test("the shared metadata covers every contributed tool", () => {
        for (const name of TOOL_NAMES) {
            assert.ok(TOOL_TITLES[name], name);
            assert.ok(TOOL_DESCRIPTIONS[name], name);
        }
    });
});
