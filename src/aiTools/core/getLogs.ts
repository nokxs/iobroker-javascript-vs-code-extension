import { ensureConnected } from "./connection";
import { readLogs } from "./logs";
import { GetLogsDto, GetLogsInput, ToolDeps, ToolOutcome } from "./types";

/** Reads a bounded tail of an ioBroker host log. The parsing and filtering live in `readLogs`. */
export async function getLogs(deps: ToolDeps, input: GetLogsInput): Promise<ToolOutcome<GetLogsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    return readLogs(deps.logs, input);
}
