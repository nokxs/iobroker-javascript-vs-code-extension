import * as assert from "assert";
import { ScriptId } from "../../models/ScriptId";

suite("ScriptId", () => {
    test("isValid accepts ids below the script namespace", () => {
        assert.strictEqual(ScriptId.isValid("script.js.MyScript"), true);
        assert.strictEqual(ScriptId.isValid("script.js.common.Licht"), true);
    });

    test("isValid rejects the root id and foreign namespaces", () => {
        assert.strictEqual(ScriptId.isValid(ScriptId.rootId), false);
        assert.strictEqual(ScriptId.isValid("script.js."), false);
        assert.strictEqual(ScriptId.isValid("script.jsfoo"), false);
        assert.strictEqual(ScriptId.isValid("javascript.0.state"), false);
        assert.strictEqual(ScriptId.isValid(""), false);
    });

    test("isValid rejects empty segments", () => {
        assert.strictEqual(ScriptId.isValid("script.js..Licht"), false);
        assert.strictEqual(ScriptId.isValid("script.js.common..Licht"), false);
        assert.strictEqual(ScriptId.isValid("script.js.common."), false);
    });

    test("isDirectoryId accepts the root id and every script id", () => {
        assert.strictEqual(ScriptId.isDirectoryId(ScriptId.rootId), true);
        assert.strictEqual(ScriptId.isDirectoryId("script.js.common"), true);
        assert.strictEqual(ScriptId.isDirectoryId("script.js.global.07-late-dependencies.devices"), true);
    });

    test("isDirectoryId rejects invalid ids", () => {
        assert.strictEqual(ScriptId.isDirectoryId("script.js."), false);
        assert.strictEqual(ScriptId.isDirectoryId("script.js.common."), false);
        assert.strictEqual(ScriptId.isDirectoryId("common"), false);
    });

    test("lastSegmentOf returns the last id segment", () => {
        assert.strictEqual(ScriptId.lastSegmentOf("script.js.common.Licht"), "Licht");
        assert.strictEqual(ScriptId.lastSegmentOf("script.js.Licht"), "Licht");
        assert.strictEqual(ScriptId.lastSegmentOf(ScriptId.rootId), "js");
    });

    test("parentIdOf returns the parent id or undefined for the root", () => {
        assert.strictEqual(ScriptId.parentIdOf("script.js.common.Licht"), "script.js.common");
        assert.strictEqual(ScriptId.parentIdOf("script.js.Licht"), ScriptId.rootId);
        assert.strictEqual(ScriptId.parentIdOf(ScriptId.rootId), undefined);
        assert.strictEqual(ScriptId.parentIdOf(".Licht"), undefined);
    });

    test("the constructor accepts valid script ids", () => {
        assert.strictEqual(`${new ScriptId("script.js.common.Licht")}`, "script.js.common.Licht");
    });

    test("the constructor rejects ids that are not a script id", () => {
        assert.throws(() => new ScriptId("script.js"));
        assert.throws(() => new ScriptId("script.js."));
        assert.throws(() => new ScriptId("script.js..Licht"));
        assert.throws(() => new ScriptId("javascript.0.state"));
    });
});
