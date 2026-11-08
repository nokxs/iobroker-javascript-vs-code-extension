import * as assert from "assert";
import { ROOT_DIRECTORY_ID, isDirectoryId, isScriptId, lastSegmentOf, parentIdOf } from "../../models/ScriptIdPath";

suite("ScriptIdPath", () => {
    test("isScriptId accepts ids below the script namespace", () => {
        assert.strictEqual(isScriptId("script.js.MyScript"), true);
        assert.strictEqual(isScriptId("script.js.common.Licht"), true);
    });

    test("isScriptId rejects the root id and foreign namespaces", () => {
        assert.strictEqual(isScriptId(ROOT_DIRECTORY_ID), false);
        assert.strictEqual(isScriptId("script.js."), false);
        assert.strictEqual(isScriptId("script.jsfoo"), false);
        assert.strictEqual(isScriptId("javascript.0.state"), false);
        assert.strictEqual(isScriptId(""), false);
    });

    test("isScriptId rejects empty segments", () => {
        assert.strictEqual(isScriptId("script.js..Licht"), false);
        assert.strictEqual(isScriptId("script.js.common..Licht"), false);
        assert.strictEqual(isScriptId("script.js.common."), false);
    });

    test("isDirectoryId accepts the root id and every script id", () => {
        assert.strictEqual(isDirectoryId(ROOT_DIRECTORY_ID), true);
        assert.strictEqual(isDirectoryId("script.js.common"), true);
        assert.strictEqual(isDirectoryId("script.js.global.07-late-dependencies.devices"), true);
    });

    test("isDirectoryId rejects invalid ids", () => {
        assert.strictEqual(isDirectoryId("script.js."), false);
        assert.strictEqual(isDirectoryId("script.js.common."), false);
        assert.strictEqual(isDirectoryId("common"), false);
    });

    test("lastSegmentOf returns the last id segment", () => {
        assert.strictEqual(lastSegmentOf("script.js.common.Licht"), "Licht");
        assert.strictEqual(lastSegmentOf("script.js.Licht"), "Licht");
        assert.strictEqual(lastSegmentOf(ROOT_DIRECTORY_ID), "js");
    });

    test("parentIdOf returns the parent id or undefined for the root", () => {
        assert.strictEqual(parentIdOf("script.js.common.Licht"), "script.js.common");
        assert.strictEqual(parentIdOf("script.js.Licht"), ROOT_DIRECTORY_ID);
        assert.strictEqual(parentIdOf(ROOT_DIRECTORY_ID), undefined);
        assert.strictEqual(parentIdOf(".Licht"), undefined);
    });
});
