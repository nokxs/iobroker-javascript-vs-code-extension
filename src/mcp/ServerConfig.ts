import type { LogLevel } from "./Logger";

/** A configuration problem that has to be reported before the protocol starts (exit code 2). */
export class ConfigError extends Error {
    constructor(readonly variable: string, message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug", "silly"];

/**
 * The complete configuration of the server. The environment is the only source; a variable that is
 * set but empty is treated as missing.
 */
export class ServerConfig {
    private constructor(
        readonly url: string,
        readonly socketIoPort: number,
        readonly username: string | undefined,
        readonly password: string | undefined,
        readonly allowSelfSignedCertificate: boolean,
        readonly readOnly: boolean,
        readonly scriptAutoRun: boolean,
        readonly logLevel: LogLevel
    ) { }

    static fromEnvironment(env: { [key: string]: string | undefined }): ServerConfig {
        const url = readRequired(env, "IOBROKER_MCP_URL");
        const parsed = parseUrl(url);
        const socketIoPort = readPort(parsed);

        const username = readOptional(env, "IOBROKER_MCP_USERNAME");
        const password = readOptional(env, "IOBROKER_MCP_PASSWORD");

        if (password !== undefined && username === undefined) {
            throw new ConfigError("IOBROKER_MCP_USERNAME", "is required when IOBROKER_MCP_PASSWORD is set.");
        }

        if (username !== undefined && password === undefined) {
            throw new ConfigError("IOBROKER_MCP_PASSWORD", "is required when IOBROKER_MCP_USERNAME is set.");
        }

        return new ServerConfig(
            // A trailing slash would end up in the socket URL, where the extension never has one.
            url.replace(/\/+$/, ""),
            socketIoPort,
            username,
            password,
            readBoolean(env, "IOBROKER_MCP_ALLOW_SELF_SIGNED", false),
            readBoolean(env, "IOBROKER_MCP_READ_ONLY", false),
            readBoolean(env, "IOBROKER_MCP_SCRIPT_AUTO_RUN", false),
            readLogLevel(env)
        );
    }

    /** Never serialise the password, not even by accident through `JSON.stringify(config)`. */
    toJSON(): unknown {
        return {
            url: this.url,
            username: this.username,
            password: this.password === undefined ? undefined : "***",
            allowSelfSignedCertificate: this.allowSelfSignedCertificate,
            readOnly: this.readOnly,
            scriptAutoRun: this.scriptAutoRun,
            logLevel: this.logLevel
        };
    }

    toLogString(): string {
        return [
            `url=${this.url}`,
            `username=${this.username ?? "(none)"}`,
            `password="${this.password === undefined ? "(none)" : "***"}"`,
            `readOnly=${this.readOnly}`,
            `allowSelfSigned=${this.allowSelfSignedCertificate}`,
            `scriptAutoRun=${this.scriptAutoRun}`,
            `logLevel=${this.logLevel}`
        ].join(" ");
    }
}

function readOptional(env: { [key: string]: string | undefined }, name: string): string | undefined {
    const value = env[name]?.trim();
    return value ? value : undefined;
}

function readRequired(env: { [key: string]: string | undefined }, name: string): string {
    const value = readOptional(env, name);
    if (!value) {
        throw new ConfigError(name, "is required.");
    }

    return value;
}

function parseUrl(url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new ConfigError("IOBROKER_MCP_URL", "must be a valid URL like 'http://host:8081'.");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ConfigError("IOBROKER_MCP_URL", "must use the http or https scheme.");
    }

    if (!parsed.hostname) {
        throw new ConfigError("IOBROKER_MCP_URL", "must contain a host name.");
    }

    return parsed;
}

function readPort(parsed: URL): number {
    if (!parsed.port) {
        return parsed.protocol === "https:" ? 443 : 80;
    }

    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigError("IOBROKER_MCP_URL", "must contain a valid port.");
    }

    return port;
}

function readBoolean(env: { [key: string]: string | undefined }, name: string, fallback: boolean): boolean {
    const value = readOptional(env, name)?.toLowerCase();
    if (value === undefined) {
        return fallback;
    }

    if (value === "true" || value === "1" || value === "yes" || value === "on") {
        return true;
    }

    if (value === "false" || value === "0" || value === "no" || value === "off") {
        return false;
    }

    throw new ConfigError(name, "must be one of true/false, 1/0, yes/no or on/off.");
}

function readLogLevel(env: { [key: string]: string | undefined }): LogLevel {
    const value = readOptional(env, "IOBROKER_MCP_LOG_LEVEL")?.toLowerCase();
    if (value === undefined) {
        return "info";
    }

    if (!LOG_LEVELS.includes(value as LogLevel)) {
        throw new ConfigError("IOBROKER_MCP_LOG_LEVEL", `must be one of ${LOG_LEVELS.join(", ")}.`);
    }

    return value as LogLevel;
}
