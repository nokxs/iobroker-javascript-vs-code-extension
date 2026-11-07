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

const LOG_LEVELS: LogLevel[] = ["silly", "debug", "info", "warn", "error"];
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    silly: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};

/** Reads a bounded tail of an ioBroker host log and applies optional filters. */
export async function getLogs(deps: ToolDeps, input: GetLogsInput): Promise<ToolOutcome<GetLogsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const hostId = typeof input.hostId === "string" ? input.hostId.trim() : "";
    if (input.hostId !== undefined && (hostId.length === 0 || hostId.length > 255 || /\s/.test(hostId))) {
        return failure("invalid_input", "'hostId' must be a host id without whitespace.", "Use an id such as 'system.host.myHost'.");
    }

    const level = input.level;
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
        const matchingLines = logLines.filter(line =>
            matchesLevel(line, level) &&
            containsFilter(line, search.data) &&
            containsFilter(line, source.data)
        );
        const bounded = boundLogEntries(matchingLines);

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

function normalizeFilter(raw: unknown, field: string): ToolOutcome<string> {
    if (raw === undefined) {
        return success("");
    }

    if (typeof raw !== "string" || raw.length > 200) {
        return failure("invalid_input", `'${field}' must be a string of at most 200 characters.`);
    }

    return success(raw.trim().toLowerCase());
}

function containsFilter(line: string, filter: string): boolean {
    return filter.length === 0 || line.toLowerCase().includes(filter);
}

function matchesLevel(line: string, requestedLevel: LogLevel | undefined): boolean {
    if (!requestedLevel) {
        return true;
    }

    const match = line.match(/\b(silly|debug|info|warn(?:ing)?|error)\b/i);
    if (!match) {
        return false;
    }

    const lineLevel = match[1].toLowerCase() === "warning" ? "warn" : match[1].toLowerCase() as LogLevel;
    return LOG_LEVEL_RANK[lineLevel] >= LOG_LEVEL_RANK[requestedLevel];
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
