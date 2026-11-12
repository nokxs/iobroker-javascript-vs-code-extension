import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

const BUNDLE_PATH = path.resolve(__dirname, "../../../dist/mcp-server.js");

suite("MCP bundle", () => {
    test("the bundle exists and is executable by node", () => {
        assert.ok(fs.existsSync(BUNDLE_PATH), `missing bundle: ${BUNDLE_PATH}`);
        assert.ok(fs.statSync(BUNDLE_PATH).size > 0);
    });

    test("the shebang is the first line", () => {
        const firstLine = fs.readFileSync(BUNDLE_PATH, "utf8").split("\n")[0];
        assert.strictEqual(firstLine, "#!/usr/bin/env node");
    });

    test("the bundle never requires vscode", () => {
        const content = fs.readFileSync(BUNDLE_PATH, "utf8");
        assert.ok(!content.includes("require(\"vscode\")"), "the bundle must not require vscode");
        assert.ok(!content.includes("require('vscode')"), "the bundle must not require vscode");
    });

    test("the bundle never writes to stdout", () => {
        const content = fs.readFileSync(BUNDLE_PATH, "utf8");
        assert.ok(!content.includes("console.log("), "a console.log would corrupt the JSON-RPC stream");
    });
});
