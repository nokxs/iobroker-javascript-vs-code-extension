import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { TOOL_NAMES, TOOL_SCHEMAS } from "../../aiTools/schemas";

interface ContributedTool {
    name: string
    displayName: string
    modelDescription: string
    toolReferenceName: string
    canBeReferencedInPrompt: boolean
    when: string
    inputSchema: unknown
}

suite("AI tools contribution", () => {
    const packageJsonPath = path.resolve(__dirname, "../../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const contributed: ContributedTool[] = packageJson.contributes.languageModelTools;

    test("contributes every tool exactly once", () => {
        assert.ok(contributed, "contributes.languageModelTools is missing");
        assert.strictEqual(contributed.length, TOOL_NAMES.length);

        const names = contributed.map(tool => tool.name);
        assert.deepStrictEqual(names.slice().sort(), TOOL_NAMES.slice().sort());
        assert.strictEqual(new Set(names).size, names.length, "tool names have to be unique");
    });

    test("mirrors the input schemas of src/aiTools/schemas.ts", () => {
        for (const tool of contributed) {
            assert.deepStrictEqual(tool.inputSchema, TOOL_SCHEMAS[<keyof typeof TOOL_SCHEMAS>tool.name], tool.name);
        }
    });

    test("tools are opt-in, referenceable and described", () => {
        for (const tool of contributed) {
            assert.strictEqual(tool.when, "iobrokerAiToolsEnabled", tool.name);
            assert.strictEqual(tool.canBeReferencedInPrompt, true, tool.name);
            assert.ok(tool.toolReferenceName && tool.toolReferenceName.length > 0, tool.name);
            assert.ok(tool.displayName && tool.displayName.length > 0, tool.name);
            assert.ok(tool.modelDescription && tool.modelDescription.length > 40, tool.name);
        }
    });

    test("contributes the toggle command", () => {
        const commands: Array<{ command: string }> = packageJson.contributes.commands;
        assert.ok(commands.some(command => command.command === "iobroker-javascript.toggleAiTools"));
    });
});
