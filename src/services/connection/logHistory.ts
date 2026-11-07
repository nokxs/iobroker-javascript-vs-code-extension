import { promisify } from "util";
import { gunzip } from "zlib";
import { LogHistoryOptions, LogHistoryResult } from "../../models/LogHistory";
import { LogLevel } from "../../models/LogLevel";

const gunzipAsync = promisify(gunzip);
const MAX_LOG_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DECOMPRESSED_LOG_FILE_BYTES = 50 * 1024 * 1024;
const FEATURE_CHECK_TIMEOUT_MS = 2000;
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    silly: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
const ENTRY_HEADER = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+-\s+(silly|debug|info|warn|error):\s+(\S+).*$/i;
const ROTATED_FILE = /\.(\d{4})-(\d{2})-(\d{2})(?:\.(\d+))?(?:\.[^.\d][^.]*)?(?:\.gz)?$/i;

export type HostCommandRequest = (command: string, message: unknown, timeoutMs?: number) => Promise<unknown>;

interface LogFile {
    fileName: string
    transport: string
    name: string
    size: number
    day?: string
    counter: number
    current: boolean
}

interface LogEntry {
    timestamp: number
    level: LogLevel
    source: string
    lines: string[]
}

/** Searches available log files, using the controller's search command when supported. */
export async function searchHostLogs(request: HostCommandRequest, options: LogHistoryOptions): Promise<LogHistoryResult> {
    const until = options.before ?? Date.now();
    const nativeSearchError: string[] = [];

    if (supportsFeatureCheck(options.controllerVersion)) {
        try {
            const feature = await request("checkFeatureSupported", "CONTROLLER_SEARCH_LOGS", FEATURE_CHECK_TIMEOUT_MS);
            if (isRecord(feature) && feature.result === true) {
                try {
                    const response = await request("searchLogs", {
                        hours: options.hours,
                        now: until,
                        level: options.level,
                        source: options.source,
                        text: options.search,
                        maxRows: options.maxRows
                    });
                    const result = parseNativeSearch(response, until);
                    if (result) {
                        return result;
                    }
                    nativeSearchError.push("The controller returned an invalid search response.");
                } catch (error) {
                    nativeSearchError.push(errorMessage(error));
                }
            }
        } catch (error) {
            nativeSearchError.push(errorMessage(error));
        }
    }

    try {
        return await searchLogFiles(request, options, until);
    } catch (error) {
        if (nativeSearchError.length > 0) {
            throw new Error(`Controller log search failed (${nativeSearchError.join("; ")}); reading rotated log files also failed: ${errorMessage(error)}`);
        }
        throw error;
    }
}

async function searchLogFiles(request: HostCommandRequest, options: LogHistoryOptions, until: number): Promise<LogHistoryResult> {
    const fileListAnswer = await request("getLogFiles", null);
    const fileList = parseLogFileList(fileListAnswer);
    const files = selectFiles(fileList, until - options.hours * 60 * 60 * 1000, until);
    if (files.length === 0) {
        throw new Error("The host has no accessible current or rotated log files within the requested time range.");
    }

    const newestEntries: string[] = [];
    let scannedFiles = 0;
    let scannedLines = 0;
    let truncated = false;

    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (file.size > MAX_LOG_FILE_BYTES) {
            throw new Error(`Log file '${file.name}' is ${formatMegabytes(file.size)} MB, above the ${formatMegabytes(MAX_LOG_FILE_BYTES)} MB read limit. Narrow the time range or use a controller version with native log search.`);
        }

        const fileAnswer = await request("getLogFile", { filename: file.name, transport: file.transport });
        const contents = await readLogFile(fileAnswer, file);
        const entries = matchingEntries(contents, options, until - options.hours * 60 * 60 * 1000, until);
        const linesInFile = contents.split(/\r?\n/);
        scannedLines += linesInFile.length - (linesInFile[linesInFile.length - 1] === "" ? 1 : 0);
        scannedFiles++;

        const newestMatches = entries.reverse();
        const remaining = options.maxRows - newestEntries.length;
        newestEntries.push(...newestMatches.slice(0, remaining));

        if (newestMatches.length > remaining || (newestEntries.length >= options.maxRows && index < files.length - 1)) {
            truncated = true;
            break;
        }
    }

    const orderedEntries = newestEntries.reverse();
    return {
        entries: orderedEntries,
        scannedFiles: scannedFiles,
        scannedLines: scannedLines,
        truncated: truncated,
        until: until,
        nextBefore: getNextBefore(orderedEntries)
    };
}

function parseNativeSearch(answer: unknown, until: number): LogHistoryResult | undefined {
    if (!isRecord(answer) || !Array.isArray(answer.lines) || answer.lines.some(line => typeof line !== "string")) {
        return undefined;
    }

    return {
        entries: answer.lines,
        scannedFiles: typeof answer.files === "number" ? answer.files : 0,
        scannedLines: 0,
        truncated: answer.truncated === true,
        until: typeof answer.until === "number" ? answer.until : until,
        nextBefore: getNextBefore(answer.lines)
    };
}

function parseLogFileList(answer: unknown): LogFile[] {
    const hostError = getHostCommandError(answer);
    if (hostError) {
        throw new Error(`The host could not list its log files: ${hostError}`);
    }

    if (!isRecord(answer) || !Array.isArray(answer.list)) {
        throw new Error("The host returned an invalid log-file list.");
    }

    const files: LogFile[] = [];
    for (const item of answer.list) {
        if (!isRecord(item) || typeof item.fileName !== "string") {
            continue;
        }

        const parts = item.fileName.replace(/\\/g, "/").split("/");
        if (parts.length < 4 || parts[0] !== "log") {
            continue;
        }

        const transport = parts[2];
        const name = parts.slice(3).join("/");
        if (!transport || !name || name.includes("..") || name.startsWith("/")) {
            continue;
        }

        const baseName = name.substring(name.lastIndexOf("/") + 1);
        const rotated = baseName.match(ROTATED_FILE);
        const current = !rotated && /\.log$/i.test(baseName);
        if (!rotated && !current) {
            continue;
        }

        files.push({
            fileName: item.fileName,
            transport: transport,
            name: name,
            size: typeof item.size === "number" ? item.size : 0,
            day: rotated ? `${rotated[1]}-${rotated[2]}-${rotated[3]}` : undefined,
            counter: rotated?.[4] ? Number(rotated[4]) : 0,
            current: current
        });
    }

    return files;
}

function selectFiles(files: LogFile[], since: number, until: number): LogFile[] {
    const selected = files.filter(file => {
        if (file.current) {
            return true;
        }

        if (!file.day) {
            return false;
        }

        const [year, month, day] = file.day.split("-").map(Number);
        const dayStart = new Date(year, month - 1, day).getTime();
        const nextDayStart = new Date(year, month - 1, day + 1).getTime();
        return dayStart < until && nextDayStart > since;
    });

    selected.sort((left, right) => {
        if (left.current !== right.current) {
            return left.current ? -1 : 1;
        }
        if (left.day !== right.day) {
            return (right.day ?? "").localeCompare(left.day ?? "");
        }
        if (left.counter !== right.counter) {
            return right.counter - left.counter;
        }
        return left.name.localeCompare(right.name);
    });

    const seenNames = new Set<string>();
    return selected.filter(file => {
        const key = `${file.transport}/${file.name}`;
        if (seenNames.has(key)) {
            return false;
        }
        seenNames.add(key);
        return true;
    });
}

async function readLogFile(answer: unknown, file: LogFile): Promise<string> {
    const hostError = getHostCommandError(answer);
    if (hostError) {
        throw new Error(`The host could not read log file '${file.name}': ${hostError}`);
    }

    if (!isRecord(answer) || !("data" in answer)) {
        throw new Error(`The host returned an invalid response for log file '${file.name}'.`);
    }

    let data = toBuffer(answer.data);
    if (!data) {
        throw new Error(`The host returned invalid contents for log file '${file.name}'.`);
    }

    if (data.length > MAX_LOG_FILE_BYTES) {
        throw new Error(`Log file '${file.name}' exceeds the ${formatMegabytes(MAX_LOG_FILE_BYTES)} MB read limit.`);
    }

    if (answer.gz === true || file.name.toLowerCase().endsWith(".gz")) {
        try {
            data = await gunzipAsync(data, { maxOutputLength: MAX_DECOMPRESSED_LOG_FILE_BYTES });
        } catch (error) {
            if (isRecord(error) && error.code === "ERR_BUFFER_TOO_LARGE") {
                throw new Error(`Log file '${file.name}' expands beyond the ${formatMegabytes(MAX_DECOMPRESSED_LOG_FILE_BYTES)} MB read limit.`);
            }
            throw error;
        }
    }
    if (data.length > MAX_DECOMPRESSED_LOG_FILE_BYTES) {
        throw new Error(`Log file '${file.name}' expands beyond the ${formatMegabytes(MAX_DECOMPRESSED_LOG_FILE_BYTES)} MB read limit.`);
    }

    return data.toString("utf8");
}

function matchingEntries(contents: string, options: LogHistoryOptions, since: number, until: number): string[] {
    const entries: LogEntry[] = [];
    const search = options.search?.toLowerCase();
    for (const line of contents.split(/\r?\n/)) {
        const match = line.replace(ANSI_ESCAPE, "").match(ENTRY_HEADER);
        if (match) {
            const timestamp = new Date(`${match[1]}T${match[2]}`).getTime();
            entries.push({
                timestamp: timestamp,
                level: match[3].toLowerCase() as LogLevel,
                source: match[4].toLowerCase(),
                lines: [line]
            });
        } else if (entries.length > 0) {
            entries[entries.length - 1].lines.push(line);
        }
    }

    return entries
        .filter(entry =>
            entry.timestamp >= since &&
            entry.timestamp <= until &&
            matchesLevel(entry.level, options.level) &&
            (!options.source || entry.source === options.source) &&
            (!search || entry.lines.some(line => line.toLowerCase().includes(search)))
        )
        .map(entry => entry.lines.join("\n"));
}

function matchesLevel(level: LogLevel, requestedLevel?: LogLevel): boolean {
    return !requestedLevel || LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[requestedLevel];
}

function getHostCommandError(answer: unknown): string | undefined {
    if (answer === "permissionError") {
        return "the logged in user is not allowed to read logs. Ask the user to grant the 'sendToHost' permission.";
    }
    if (isRecord(answer) && "error" in answer) {
        return answer.error === "permissionError"
            ? "the logged in user is not allowed to read logs. Ask the user to grant the 'sendToHost' permission."
            : `the host reported an error: ${String(answer.error)}.`;
    }
    return undefined;
}

function toBuffer(value: unknown): Buffer | undefined {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    if (value instanceof Uint8Array) {
        return Buffer.from(value);
    }
    if (typeof value === "string") {
        return Buffer.from(value, "utf8");
    }
    if (isRecord(value) && Array.isArray(value.data) && value.data.every(byte => typeof byte === "number")) {
        return Buffer.from(value.data);
    }
    return undefined;
}

function getNextBefore(entries: string[]): number | null {
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
        const firstLine = entry.split(/\r?\n/, 1)[0].replace(ANSI_ESCAPE, "");
        const match = firstLine.match(ENTRY_HEADER);
        if (match) {
            const timestamp = new Date(`${match[1]}T${match[2]}`).getTime();
            if (Number.isFinite(timestamp)) {
                oldestTimestamp = Math.min(oldestTimestamp, timestamp);
            }
        }
    }

    return oldestTimestamp > 0 && Number.isFinite(oldestTimestamp) ? oldestTimestamp - 1 : null;
}

function supportsFeatureCheck(version?: string): boolean {
    const match = version?.match(/^(\d+)\.(\d+)/);
    if (!match) {
        return false;
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    return major > 7 || (major === 7 && minor >= 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function formatMegabytes(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(0);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
