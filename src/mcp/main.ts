import "reflect-metadata";
import { Logger } from "./Logger";
import { McpServerRunner } from "./McpServerRunner";
import { ConfigError, ServerConfig } from "./ServerConfig";
import { BUILD_VERSION } from "./version";

const HELP = `ioBroker MCP server ${BUILD_VERSION}

Usage: iobroker-mcp [--version] [--check] [--help]

The server is configured completely through environment variables:
  IOBROKER_MCP_URL                required, http://host:8081 or https://host:8081
  IOBROKER_MCP_USERNAME           required when the ioBroker login is enabled
  IOBROKER_MCP_PASSWORD           required when the ioBroker login is enabled
  IOBROKER_MCP_ALLOW_SELF_SIGNED  optional, default false
  IOBROKER_MCP_READ_ONLY          optional, default false; hides every write tool
  IOBROKER_MCP_SCRIPT_AUTO_RUN    optional, default false
  IOBROKER_MCP_LOG_LEVEL          optional, one of error, warn, info, debug, silly

Flags:
  --version  print the version
  --check    validate the environment, print a redacted summary to stderr and exit
  --help     print this help

All diagnostics go to stderr; stdout carries the JSON-RPC protocol.
`;

/** Only used by the last resort handler, so a stack trace can be redacted once the config is known. */
let logger: Logger | undefined;

async function main(): Promise<number> {
    const args = process.argv.slice(2);

    if (args.includes("--help")) {
        process.stdout.write(HELP);
        return 0;
    }

    if (args.includes("--version")) {
        process.stdout.write(`${BUILD_VERSION}\n`);
        return 0;
    }

    let config: ServerConfig;
    try {
        config = ServerConfig.fromEnvironment(process.env);
    } catch (error) {
        const message = error instanceof ConfigError
            ? `${error.variable}: ${error.message}`
            : `${error instanceof Error ? error.message : error}`;
        process.stderr.write(`iobroker-mcp [error] ${message}\n`);
        return 2;
    }

    const log = new Logger(config.logLevel);
    log.addSecret(config.password);
    logger = log;

    if (args.includes("--check")) {
        // Deliberately does not connect, so it is safe to run in a shell.
        process.stderr.write(`iobroker-mcp [info] ${config.toLogString()}\n`);
        return 0;
    }

    process.on("uncaughtException", error => {
        log.error(`Uncaught exception: ${log.redact(error.stack ?? error.message)}`);
        process.exit(1);
    });

    process.on("unhandledRejection", reason => {
        log.error(`Unhandled rejection: ${reason instanceof Error ? log.redact(reason.stack ?? reason.message) : `${reason}`}`);
        process.exit(1);
    });

    const runner = McpServerRunner.create(config, log);
    await runner.run();
    return 0;
}

main().then(code => {
    process.exitCode = code;
}).catch(error => {
    const message = error instanceof Error ? error.stack ?? error.message : `${error}`;
    process.stderr.write(`iobroker-mcp [error] ${logger ? logger.redact(message) : message}\n`);
    process.exit(1);
});
