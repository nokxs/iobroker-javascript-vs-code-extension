/**
 * All diagnostics of the MCP server go to stderr. stdout is reserved for JSON-RPC frames, so a
 * single `console.log` would corrupt the protocol.
 */
export type LogLevel = "error" | "warn" | "info" | "debug" | "silly";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    silly: 4
};

const PREFIX = "iobroker-mcp";

/** Replaces secrets that must never appear in a log line, a tool result or an error message. */
export class Redactor {
    private readonly secrets: string[] = [];

    /** Registers a value that is replaced wherever it appears. Short values are ignored. */
    add(secret: string | undefined): void {
        if (!secret || secret.length < 4 || this.secrets.includes(secret)) {
            return;
        }

        // Longest first, so a token that contains the password is fully removed.
        this.secrets.push(secret);
        this.secrets.sort((a, b) => b.length - a.length);
    }

    redact(text: string): string {
        let result = text;

        for (const secret of this.secrets) {
            result = result.split(secret).join("***");
        }

        return result
            .replace(/(access_token=)[^;\s"']+/gi, "$1***")
            .replace(/(connect\.sid=)[^;\s"']+/gi, "$1***")
            .replace(/([?&]password=)[^&\s"']+/gi, "$1***");
    }
}

export interface ILogger {
    /** Registers a value that has to be masked in every log line and tool result. */
    addSecret(secret: string | undefined): void
    redact(text: string): string
    error(message: string): void
    warn(message: string): void
    info(message: string): void
    debug(message: string): void
    silly(message: string): void
}

/** Writes one redacted line per event to stderr. */
export class Logger implements ILogger {
    constructor(
        private readonly level: LogLevel,
        readonly redactor: Redactor = new Redactor()
    ) { }

    /** Registers a value that has to be masked in every log line and tool result. */
    addSecret(secret: string | undefined): void {
        this.redactor.add(secret);
    }

    redact(text: string): string {
        return this.redactor.redact(text);
    }

    error(message: string): void {
        this.write("error", message);
    }

    warn(message: string): void {
        this.write("warn", message);
    }

    info(message: string): void {
        this.write("info", message);
    }

    debug(message: string): void {
        this.write("debug", message);
    }

    silly(message: string): void {
        this.write("silly", message);
    }

    private write(level: LogLevel, message: string): void {
        if (LOG_LEVEL_RANK[level] > LOG_LEVEL_RANK[this.level]) {
            return;
        }

        process.stderr.write(`${PREFIX} [${level}] ${this.redactor.redact(message)}\n`);
    }
}
