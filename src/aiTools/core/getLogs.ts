import { ensureConnected } from "./connection";
import { toFailure } from "./helpers";
import {
    DEFAULT_LOG_LIMIT,
    failure,
    GetLogsDto,
    GetLogsInput,
    LogLevel,
    MAX_LOG_LIMIT,
    MAX_LOG_RESPONSE_CHARACTERS,
    success,
    ToolDeps,
    ToolOutcome
} from "./types";
import { toBoundedInteger } from "./validation";

/** Log levels from the least to the most severe, the order ioBroker uses. */
const LOG_LEVELS: LogLevel[] = ["silly", "debug", "info", "warn", "error"];
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    silly: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};

/**
 * The ioBroker logger writes one entry per line, starting with a time stamp, and continues an entry
 * over further lines - a stack trace - which carry no time stamp. The level can be wrapped in color
 * codes, so they have to be removed before the header can be read.
 */
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
const ENTRY_HEADER = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+-\s+(silly|debug|info|warn|error):(?:\s+(\S+).*)?\r?$/i;

interface LogEntry {
    lines: string[]
    /** Undefined for a line that does not start an entry, e.g. the tail of a rotated file. */
    level?: LogLevel
    source: string
}

/** Reads a bounded tail of an ioBroker host log and applies the optional filters to whole entries. */
export async function getLogs(deps: ToolDeps, input: GetLogsInput): Promise<ToolOutcome<GetLogsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const hostId = typeof input.hostId === "string" ? input.hostId.trim() : "";
    if (input.hostId !== undefined && (hostId.length === 0 || hostId.length > 255 || /\s/.test(hostId))) {
        return failure("invalid_input", "'hostId' must be a host id without whitespace.", "Use an id such as 'system.host.myHost'.");
    }

    const level = typeof input.level === "string" ? input.level.trim().toLowerCase() as LogLevel : input.level;
    if (level !== undefined && !LOG_LEVELS.includes(level)) {
        return failure("invalid_input", `'level' must be one of ${LOG_LEVELS.join(", ")}.`);
    }

    const search = normalizeFilter(input.search, "search");
    if (!search.ok) {
        return search;
    }

    const source = normalizeFilter(input.source, "source");
    if (!source.ok) {
        return source;
    }

    const lines = toBoundedInteger(input.lines, DEFAULT_LOG_LIMIT, 1, MAX_LOG_LIMIT);

    try {
        const hosts = await deps.logs.getHosts();
        let host: (typeof hosts)[number] | undefined;

        if (hostId) {
            host = hosts.find(candidate => candidate.id === hostId);
            if (!host) {
                return failure(
                    "not_found",
                    `The ioBroker host '${hostId}' was not found.`,
                    `Available host ids: ${hosts.map(candidate => candidate.id).join(", ") || "(none)"}.`
                );
            }
        } else if (hosts.length === 1) {
            host = hosts[0];
        } else if (hosts.length === 0) {
            return failure("not_found", "No ioBroker hosts were found.");
        } else {
            return failure(
                "ambiguous",
                "More than one ioBroker host is available. Specify 'hostId' to select the host whose log should be read.",
                `Available host ids: ${hosts.map(candidate => candidate.id).join(", ")}.`
            );
        }

        const logLines = await deps.logs.getLogs(host.id, lines);
        const entries = toLogEntries(logLines).filter(entry =>
            matchesLevel(entry, level) &&
            matchesSource(entry, source.data) &&
            matchesSearch(entry, search.data)
        );
        const bounded = boundLogEntries(toLines(entries));

        return success({
            hostId: host.id,
            hostName: host.name,
            scannedLines: logLines.length,
            entries: bounded.entries,
            truncated: bounded.truncated
        });
    } catch (error) {
        return toFailure(error);
    }
}

/** Groups the lines of the tail into entries: a header line starts one, every other line continues it. */
function toLogEntries(lines: string[]): LogEntry[] {
    const entries: LogEntry[] = [];

    for (const line of lines) {
        const header = parseEntryHeader(line);
        if (header) {
            entries.push({ lines: [line], level: header.level, source: header.source });
            continue;
        }

        const current = entries[entries.length - 1];
        if (current) {
            current.lines.push(line);
        } else {
            entries.push({ lines: [line], source: "" });
        }
    }

    return entries;
}

function parseEntryHeader(line: string): { level: LogLevel, source: string } | undefined {
    const match = line.replace(ANSI_ESCAPE, "").match(ENTRY_HEADER);
    if (!match) {
        return undefined;
    }

    return {
        level: match[3].toLowerCase() as LogLevel,
        source: (match[4] ?? "").toLowerCase()
    };
}

function toLines(entries: LogEntry[]): string[] {
    const lines: string[] = [];
    entries.forEach(entry => lines.push(...entry.lines));
    return lines;
}

function normalizeFilter(raw: unknown, field: string): ToolOutcome<string> {
    if (raw === undefined) {
        return success("");
    }

    if (typeof raw !== "string" || raw.length > 200) {
        return failure("invalid_input", `'${field}' must be a string of at most 200 characters.`);
    }

    return success(raw.trim().toLowerCase());
}

function matchesLevel(entry: LogEntry, requestedLevel: LogLevel | undefined): boolean {
    if (!requestedLevel) {
        return true;
    }

    if (!entry.level) {
        return false;
    }

    return LOG_LEVEL_RANK[entry.level] >= LOG_LEVEL_RANK[requestedLevel];
}

function matchesSource(entry: LogEntry, filter: string): boolean {
    return filter.length === 0 || entry.source.includes(filter);
}

function matchesSearch(entry: LogEntry, filter: string): boolean {
    return filter.length === 0 || entry.lines.some(line => line.toLowerCase().includes(filter));
}

function boundLogEntries(entries: string[]): { entries: string[], truncated: boolean } {
    const result: string[] = [];
    let remainingCharacters = MAX_LOG_RESPONSE_CHARACTERS;
    const truncationMarker = "...[truncated]";

    for (const entry of entries) {
        if (entry.length <= remainingCharacters) {
            result.push(entry);
            remainingCharacters -= entry.length;
            continue;
        }

        if (remainingCharacters >= truncationMarker.length) {
            result.push(`${entry.substring(0, remainingCharacters - truncationMarker.length)}${truncationMarker}`);
        }
        return { entries: result, truncated: true };
    }

    return { entries: result, truncated: false };
}
