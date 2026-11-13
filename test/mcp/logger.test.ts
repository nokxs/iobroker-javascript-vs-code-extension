import * as assert from "assert";
import { Logger, Redactor } from "../../src/mcp/Logger";
import { ServerConfig } from "../../src/mcp/ServerConfig";

suite("MCP secrets", () => {
    test("redact masks the password in a URL, a header and a stack trace", () => {
        const redactor = new Redactor();
        redactor.add("super-secret-password");

        assert.strictEqual(
            redactor.redact("GET http://admin:super-secret-password@host:8081/"),
            "GET http://admin:***@host:8081/");
        assert.strictEqual(
            redactor.redact("cookie: connect.sid=abc123; access_token=def456"),
            "cookie: connect.sid=***; access_token=***");
        assert.strictEqual(
            redactor.redact("Error: failed\n    at Login (password=super-secret-password)"),
            "Error: failed\n    at Login (password=***)");
    });

    test("redact ignores short values", () => {
        const redactor = new Redactor();
        redactor.add("abc");

        assert.strictEqual(redactor.redact("abc def"), "abc def");
    });

    test("the logger masks a registered secret on stderr", () => {
        const logger = new Logger("error");
        logger.addSecret("super-secret-password");

        const written: string[] = [];
        const original = process.stderr.write;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stderr as any).write = (chunk: string) => {
            written.push(`${chunk}`);
            return true;
        };

        try {
            logger.error("login with super-secret-password failed");
        } finally {
            process.stderr.write = original;
        }

        assert.strictEqual(written.length, 1);
        assert.ok(!written[0].includes("super-secret-password"));
        assert.ok(written[0].includes("***"));
    });

    test("the configuration never serialises the password", () => {
        const config = ServerConfig.fromEnvironment({
            IOBROKER_MCP_URL: "http://host:8081",
            IOBROKER_MCP_USERNAME: "admin",
            IOBROKER_MCP_PASSWORD: "super-secret-password"
        });

        assert.strictEqual(config.password, "super-secret-password");
        assert.ok(!JSON.stringify(config).includes("super-secret-password"));
        assert.ok(!config.toLogString().includes("super-secret-password"));
        assert.ok(config.toLogString().includes('password="***"'));
    });

    test("the environment validation names the missing variable", () => {
        assert.throws(
            () => ServerConfig.fromEnvironment({}),
            (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_URL");

        assert.throws(
            () => ServerConfig.fromEnvironment({ IOBROKER_MCP_URL: "ftp://host" }),
            (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_URL");

        assert.throws(
            () => ServerConfig.fromEnvironment({ IOBROKER_MCP_URL: "http://host:8081", IOBROKER_MCP_USERNAME: "admin" }),
            (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_PASSWORD");

        assert.throws(
            () => ServerConfig.fromEnvironment({ IOBROKER_MCP_URL: "http://host:8081", IOBROKER_MCP_READ_ONLY: "maybe" }),
            (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_READ_ONLY");

        // Credentials in the URL would be printed by `--check`, where the redactor cannot find them.
        assert.throws(
            () => ServerConfig.fromEnvironment({ IOBROKER_MCP_URL: "http://admin:secret@host:8081" }),
            (error: Error & { variable?: string }) => error.variable === "IOBROKER_MCP_URL");
    });

    test("defaults match the documented environment", () => {
        const config = ServerConfig.fromEnvironment({ IOBROKER_MCP_URL: "http://host:8081" });

        assert.strictEqual(config.socketIoPort, 8081);
        assert.strictEqual(config.readOnly, false);
        assert.strictEqual(config.allowSelfSignedCertificate, false);
        assert.strictEqual(config.scriptAutoRun, false);
        assert.strictEqual(config.logLevel, "info");
    });
});
