import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { TOOL_NAMES, TOOL_DESCRIPTIONS, TOOL_SCHEMAS, TOOL_TITLES } from "../../aiTools/schemas";

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

    test("mirrors the title and description of every tool", () => {
        for (const tool of contributed) {
            const name = <keyof typeof TOOL_SCHEMAS>tool.name;
            assert.strictEqual(TOOL_TITLES[name], tool.displayName, tool.name);
            assert.strictEqual(TOOL_DESCRIPTIONS[name], tool.modelDescription, tool.name);
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
        const commands: Array<{ command: string; title: string }> = packageJson.contributes.commands;
        const command = commands.find(c => c.command === "iobroker-javascript.toggleAiTools");

        assert.ok(command, "the toggle command is not contributed");
        assert.ok(command.title.toLowerCase().includes("mcp server"), `the command title has to mention the MCP server: ${command.title}`);
    });

    test("the toggle command is reachable from the ioBroker view menu", () => {
        const viewTitle: Array<{ command: string; when?: string }> = packageJson.contributes.menus["view/title"];
        const entry = viewTitle.find(item => item.command === "iobroker-javascript.toggleAiTools");

        assert.ok(entry, "the toggle command is missing in the view/title menu");
        assert.strictEqual(entry.when, "view == iobroker-javascript.script-explorer");
    });
});
