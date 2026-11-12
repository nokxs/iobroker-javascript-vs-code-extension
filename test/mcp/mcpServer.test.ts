import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { spawn, spawnSync } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const SERVER_PATH = path.resolve(__dirname, "../../../dist/mcp-server.js");
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8")).version;
// The release workflow passes the tag; the regular build uses the package version, like webpack.
const EXPECTED_VERSION = process.env.BUILD_VERSION ?? PACKAGE_VERSION;

function baseEnv(extra: { [key: string]: string } = {}): { [key: string]: string } {
    return {
        PATH: process.env.PATH ?? "",
        IOBROKER_MCP_URL: "http://127.0.0.1:1",
        ...extra
    };
}

async function connectClient(extraEnv: { [key: string]: string } = {}): Promise<Client> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER_PATH],
        env: baseEnv(extraEnv),
        stderr: "pipe"
    });

    const client = new Client({ name: "iobroker-mcp-test", version: "1.0.0" });
    await client.connect(transport);
    return client;
}

async function expectProtocolError(promise: Promise<unknown>): Promise<McpError> {
    try {
        await promise;
    } catch (error) {
        assert.ok(error instanceof McpError, `expected an McpError, got ${error}`);
        return error;
    }

    throw new Error("expected a protocol error, but the call succeeded");
}

suite("MCP protocol", () => {
    test("initialize and tools/list answer without touching ioBroker", async () => {
        const client = await connectClient();

        try {
            assert.strictEqual(client.getServerVersion()?.name, "iobroker-mcp");
            assert.strictEqual(client.getServerVersion()?.version, EXPECTED_VERSION);

            const listed = await client.listTools();
            assert.strictEqual(listed.tools.length, 14);
            assert.ok(listed.tools.some(tool => tool.name === "iobroker_get_scripts"));
            assert.ok(listed.tools.some(tool => tool.name === "iobroker_update_script_source"));
        } finally {
            await client.close();
        }
    });

    test("read-only mode hides every write tool", async () => {
        const client = await connectClient({ IOBROKER_MCP_READ_ONLY: "true" });

        try {
            const listed = await client.listTools();
            assert.strictEqual(listed.tools.length, 5);
            assert.ok(!listed.tools.some(tool => tool.name === "iobroker_start_script"));

            const error = await expectProtocolError(client.callTool({ name: "iobroker_start_script", arguments: { scriptId: "script.js.common.Test" } }));
            assert.strictEqual(error.code, ErrorCode.InvalidParams);
        } finally {
            await client.close();
        }
    });

    test("an unknown tool is a protocol error, not a tool result", async () => {
        const client = await connectClient();

        try {
            const error = await expectProtocolError(client.callTool({ name: "iobroker_does_not_exist", arguments: {} }));
            assert.strictEqual(error.code, ErrorCode.InvalidParams);
            assert.ok(error.message.includes("iobroker_does_not_exist"));
        } finally {
            await client.close();
        }
    });

    test("malformed input is an isError result and the connection stays usable", async () => {
        const client = await connectClient();

        try {
            const missingId = await client.callTool({ name: "iobroker_get_script_content", arguments: {} });
            assert.strictEqual(missingId.isError, true);
            assert.ok(textOf(missingId).startsWith("invalid_input"));

            const wrongType = await client.callTool({ name: "iobroker_get_script_content", arguments: { scriptId: 42 } });
            assert.strictEqual(wrongType.isError, true);
            assert.ok(textOf(wrongType).startsWith("invalid_input"));

            // `iobroker_get_scripts` needs ioBroker and answers `not_connected`; the handler stays
            // usable afterwards, so the next malformed call is still an ordinary tool result.
            const notConnected = await client.callTool({ name: "iobroker_get_scripts", arguments: {} });
            assert.strictEqual(notConnected.isError, true);
            assert.ok(textOf(notConnected).startsWith("not_connected"));

            const stillUsable = await client.callTool({ name: "iobroker_get_state", arguments: {} });
            assert.strictEqual(stillUsable.isError, true);
            assert.ok(textOf(stillUsable).startsWith("invalid_input"));
        } finally {
            await client.close();
        }
    });
});

suite("MCP command line", () => {
    test("--version prints the injected build version", () => {
        const result = spawnSync(process.execPath, [SERVER_PATH, "--version"], { encoding: "utf8" });

        assert.strictEqual(result.status, 0);
        assert.strictEqual(result.stderr, "");
        assert.strictEqual(result.stdout.trim(), EXPECTED_VERSION);
    });

    test("--check validates the environment and prints a redacted summary", () => {
        const result = spawnSync(process.execPath, [SERVER_PATH, "--check"], {
            encoding: "utf8",
            env: baseEnv({ IOBROKER_MCP_USERNAME: "admin", IOBROKER_MCP_PASSWORD: "super-secret-password" })
        });

        assert.strictEqual(result.status, 0);
        assert.ok(result.stderr.includes('password="***"'));
        assert.ok(!result.stderr.includes("super-secret-password"));
        assert.strictEqual(result.stdout, "");
    });

    test("--check exits with 2 and names the missing variable", () => {
        const result = spawnSync(process.execPath, [SERVER_PATH, "--check"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });

        assert.strictEqual(result.status, 2);
        assert.ok(result.stderr.includes("IOBROKER_MCP_URL"));
        assert.strictEqual(result.stdout, "");
    });

    test("closing stdin exits the process with 0", async () => {
        const child = spawn(process.execPath, [SERVER_PATH], { env: baseEnv(), stdio: ["pipe", "pipe", "pipe"] });

        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", chunk => { stdout += `${chunk}`; });
        child.stderr?.on("data", chunk => { stderr += `${chunk}`; });

        await new Promise<void>((resolve, reject) => {
            const check = () => {
                if (stderr.includes("started")) {
                    resolve();
                    return;
                }

                setTimeout(check, 50);
            };

            child.on("exit", () => reject(new Error(`the server exited too early: ${stderr}`)));
            setTimeout(check, 50);
        });

        const exitCode = await new Promise<number | null>((resolve, reject) => {
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error("the server did not exit within 5 seconds after stdin closed"));
            }, 5000);

            child.on("exit", code => {
                clearTimeout(timer);
                resolve(code);
            });

            child.stdin.end();
        });

        assert.strictEqual(exitCode, 0);
        assert.strictEqual(stdout, "", "stdout must stay reserved for JSON-RPC");
    });
});

function textOf(result: unknown): string {
    const content = (result as { content?: Array<{ type: string, text?: string }> }).content ?? [];
    return content.map(part => part.text ?? "").join("\n");
}
