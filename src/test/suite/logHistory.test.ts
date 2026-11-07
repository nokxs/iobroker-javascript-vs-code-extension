import * as assert from "assert";
import { gzipSync } from "zlib";
import { LogHistoryOptions } from "../../models/LogHistory";
import { HostCommandRequest, searchHostLogs } from "../../services/connection/logHistory";

function formatLocalTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (value: number) => `${value}`.padStart(2, "0");
    const milliseconds = `${date.getMilliseconds()}`.padStart(3, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${milliseconds}`;
}

function rotatedFileDay(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (value: number) => `${value}`.padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

suite("ioBroker log history", () => {
    test("searches rotated gzip logs on controllers without native log search", async () => {
        const now = Date.now();
        const oldTimestamp = now - 48 * 60 * 60 * 1000;
        const fileName = `iobroker.${rotatedFileDay(oldTimestamp)}.log.gz`;
        const archivedLog = [
            `${formatLocalTimestamp(oldTimestamp)} - info: javascript.0 (123) healthy`,
            `${formatLocalTimestamp(oldTimestamp + 1000)} - error: javascript.0 (123) script failed`,
            "    at script.js.common.Light:12:3"
        ].join("\n");
        const compressed = gzipSync(archivedLog);
        const commands: string[] = [];

        const request: HostCommandRequest = async (command, message) => {
            commands.push(command);
            if (command === "getLogFiles") {
                return { list: [{ fileName: `log/home/file/${fileName}`, size: compressed.length }] };
            }
            if (command === "getLogFile") {
                assert.deepStrictEqual(message, { filename: fileName, transport: "file" });
                return { data: compressed, gz: true, size: compressed.length };
            }
            throw new Error(`Unexpected command '${command}'.`);
        };

        const options: LogHistoryOptions = {
            hours: 72,
            maxRows: 10,
            level: "warn",
            source: "javascript.0",
            controllerVersion: "7.1.0"
        };
        const result = await searchHostLogs(request, options);

        assert.deepStrictEqual(result.entries, [
            `${formatLocalTimestamp(oldTimestamp + 1000)} - error: javascript.0 (123) script failed\n    at script.js.common.Light:12:3`
        ]);
        assert.strictEqual(result.scannedFiles, 1);
        assert.strictEqual(result.truncated, false);
        assert.strictEqual(result.nextBefore, oldTimestamp + 999);
        assert.deepStrictEqual(commands, ["getLogFiles", "getLogFile"]);
    });

    test("uses native controller search when the host advertises support", async () => {
        const before = Date.now() - 10_000;
        const entryTimestamp = before - 1_000;
        const requests: Array<{ command: string, message: unknown }> = [];
        const request: HostCommandRequest = async (command, message) => {
            requests.push({ command: command, message: message });
            if (command === "checkFeatureSupported") {
                return { result: true };
            }
            if (command === "searchLogs") {
                return {
                    lines: [`${formatLocalTimestamp(entryTimestamp)} - error: javascript.0 old entry`],
                    files: 3,
                    truncated: true,
                    until: before
                };
            }
            throw new Error(`Unexpected command '${command}'.`);
        };

        const result = await searchHostLogs(request, {
            hours: 168,
            maxRows: 25,
            source: "javascript.0",
            search: "failed",
            before: before,
            controllerVersion: "8.0.0"
        });

        assert.deepStrictEqual(result.entries, [`${formatLocalTimestamp(entryTimestamp)} - error: javascript.0 old entry`]);
        assert.strictEqual(result.scannedFiles, 3);
        assert.strictEqual(result.truncated, true);
        assert.strictEqual(result.until, before);
        assert.strictEqual(result.nextBefore, entryTimestamp - 1);
        assert.strictEqual(requests[1].command, "searchLogs");
        const searchRequest = requests[1].message as Record<string, unknown>;
        assert.strictEqual(searchRequest.now, before);
        assert.deepStrictEqual({
            hours: searchRequest.hours,
            level: searchRequest.level,
            source: searchRequest.source,
            text: searchRequest.text,
            maxRows: searchRequest.maxRows
        }, {
            hours: 168,
            level: undefined,
            source: "javascript.0",
            text: "failed",
            maxRows: 25
        });
    });

    test("rejects oversized legacy log files without transferring them", async () => {
        const request: HostCommandRequest = async command => {
            if (command === "getLogFiles") {
                return { list: [{ fileName: "log/home/file/iobroker.log", size: 20 * 1024 * 1024 }] };
            }
            throw new Error(`Unexpected command '${command}'.`);
        };

        await assert.rejects(
            searchHostLogs(request, { hours: 24, maxRows: 10, controllerVersion: "7.1.0" }),
            /above the 15 MB read limit/
        );
    });
});
