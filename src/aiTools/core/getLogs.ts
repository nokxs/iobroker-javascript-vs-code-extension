import { ensureConnected } from "./connection";
import { toFailure } from "./helpers";
import {
    DEFAULT_LOG_HOURS,
    DEFAULT_LOG_LIMIT,
    failure,
    GetLogsDto,
    GetLogsInput,
    MAX_LOG_HOURS,
    MAX_LOG_LIMIT,
    MAX_LOG_RESPONSE_CHARACTERS,
    success,
    ToolDeps,
    ToolOutcome
} from "./types";
import type { LogLevel } from "../../models/LogLevel";
import { toBoundedInteger } from "./validation";

const LOG_LEVELS: LogLevel[] = ["silly", "debug", "info", "warn", "error"];

/** Searches a bounded time range of an ioBroker host's current and rotated log files. */
export async function getLogs(deps: ToolDeps, input: GetLogsInput): Promise<ToolOutcome<GetLogsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    const hostId = typeof input.hostId === "string" ? input.hostId.trim() : "";
    if (input.hostId !== undefined && (hostId.length === 0 || hostId.length > 255 || /\s/.test(hostId))) {
        return failure("invalid_input", "'hostId' must be a host id without whitespace.", "Use an id such as 'system.host.myHost'.");
    }

    const hours = toBoundedInteger(input.hours, DEFAULT_LOG_HOURS, 1, MAX_LOG_HOURS);
    const limit = toBoundedInteger(input.limit, DEFAULT_LOG_LIMIT, 1, MAX_LOG_LIMIT);
    if (input.before !== undefined && (typeof input.before !== "number" || !Number.isFinite(input.before) || input.before <= 0 || input.before > Date.now())) {
        return failure("invalid_input", "'before' must be a past Unix timestamp in milliseconds.", "Use the 'nextBefore' timestamp returned by a previous log search to continue with older entries.");
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
                "More than one ioBroker host is available. Specify 'hostId' to select the host whose logs should be searched.",
                `Available host ids: ${hosts.map(candidate => candidate.id).join(", ")}.`
            );
        }

        const result = await deps.logs.searchLogs(host.id, {
            hours: hours,
            maxRows: limit,
            before: input.before,
            level: level,
            source: source.data || undefined,
            search: search.data || undefined,
            controllerVersion: host.controllerVersion
        });
        const bounded = boundLogEntries(result.entries);

        return success({
            hostId: host.id,
            hostName: host.name,
            lookbackHours: hours,
            scannedFiles: result.scannedFiles,
            scannedLines: result.scannedLines,
            entries: bounded.entries,
            truncated: result.truncated || bounded.truncated,
            until: result.until,
            nextBefore: result.nextBefore
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

    return success(raw.trim());
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
