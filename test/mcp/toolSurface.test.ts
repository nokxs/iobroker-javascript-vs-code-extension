import * as assert from "assert";
import { TOOL_NAMES, TOOL_DESCRIPTIONS, TOOL_TITLES } from "../../src/aiTools/schemas";
import {
    getRemoteToolHandler,
    isReadOnlyTool,
    isRemoteToolName,
    listRemoteTools,
    REMOTE_TOOL_NAMES,
    UPDATE_SCRIPT_SOURCE_TOOL
} from "../../src/mcp/tools/remoteToolSet";

suite("MCP tool surface", () => {
    test("the server implements the 14 remote tools exactly once", () => {
        assert.strictEqual(REMOTE_TOOL_NAMES.length, 14);
        assert.strictEqual(new Set(REMOTE_TOOL_NAMES).size, REMOTE_TOOL_NAMES.length);

        for (const name of REMOTE_TOOL_NAMES) {
            assert.ok(isRemoteToolName(name), name);
            assert.strictEqual(typeof getRemoteToolHandler(name), "function", name);
        }

        assert.ok(REMOTE_TOOL_NAMES.includes(UPDATE_SCRIPT_SOURCE_TOOL));
    });

    test("every advertised tool is either a contributed tool or the new update tool", () => {
        for (const name of REMOTE_TOOL_NAMES) {
            if (name === UPDATE_SCRIPT_SOURCE_TOOL) {
                continue;
            }

            assert.ok((TOOL_NAMES as string[]).includes(name), `${name} is not contributed`);
        }

        // The four sync tools describe a local/remote difference and are dropped.
        for (const dropped of ["iobroker_upload_script", "iobroker_upload_all_changed_scripts", "iobroker_download_script", "iobroker_get_changed_scripts"]) {
            assert.ok(!(REMOTE_TOOL_NAMES as readonly string[]).includes(dropped), `${dropped} must not be advertised`);
        }
    });

    test("tools/list is filtered by the read-only switch", () => {
        const all = listRemoteTools(false);
        assert.strictEqual(all.length, 14);

        const readOnly = listRemoteTools(true);
        assert.deepStrictEqual(readOnly.map(tool => tool.name).sort(), [
            "iobroker_get_js_instances",
            "iobroker_get_logs",
            "iobroker_get_script_content",
            "iobroker_get_scripts",
            "iobroker_get_state"
        ]);

        for (const name of REMOTE_TOOL_NAMES) {
            assert.strictEqual(isReadOnlyTool(name), readOnly.some(tool => tool.name === name), name);
        }
    });

    test("every tool sets all annotations explicitly", () => {
        for (const tool of listRemoteTools(false)) {
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

    test("start/stop are writes but idempotent, renames and moves are destructive", () => {
        const byName = new Map(listRemoteTools(false).map(tool => [tool.name, tool]));

        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.readOnlyHint, false);
        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.idempotentHint, true);
        assert.strictEqual(byName.get("iobroker_start_script")?.annotations?.destructiveHint, false);

        assert.strictEqual(byName.get("iobroker_rename_script")?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get("iobroker_move_script")?.annotations?.destructiveHint, true);
        assert.strictEqual(byName.get(UPDATE_SCRIPT_SOURCE_TOOL)?.annotations?.destructiveHint, true);
    });

    test("every tool has a title, a description and an input schema", () => {
        for (const tool of listRemoteTools(false)) {
            assert.ok(tool.title && tool.title.length > 0, tool.name);
            assert.ok(tool.description && tool.description.length > 40, tool.name);
            assert.strictEqual(tool.inputSchema.type, "object", tool.name);
        }
    });

    test("the shared metadata covers every contributed tool", () => {
        for (const name of TOOL_NAMES) {
            assert.ok(TOOL_TITLES[name], name);
            assert.ok(TOOL_DESCRIPTIONS[name], name);
        }
    });
});
