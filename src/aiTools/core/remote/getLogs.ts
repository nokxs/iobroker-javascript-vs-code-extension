import { readLogs } from "../logs";
import { GetLogsDto, GetLogsInput, RemoteToolDeps, ToolOutcome } from "./types";
import { ensureRemoteConnected } from "./helpers";

/** Reads a bounded tail of an ioBroker host log. The parsing and filtering live in `readLogs`. */
export async function getLogs(deps: RemoteToolDeps, input: GetLogsInput): Promise<ToolOutcome<GetLogsDto>> {
    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    return readLogs(deps.logs, input);
}
