import { ToolError } from "./types";

/** The only connection knowledge the tools need. Implemented by the extension and the MCP server. */
export interface ConnectionState {
    isConnected(): boolean
}

/**
 * The concrete connection service opens quick picks and a login prompt when it is called.
 * Tools must never do that, so they only report the missing connection.
 */
export const DEFAULT_CONNECTION_HINT = "Ask the user to run the command 'iobroker: Connect to ioBroker' and retry afterwards.";

export function ensureConnected(deps: { connection: ConnectionState }, hint = DEFAULT_CONNECTION_HINT): ToolError | undefined {
    if (deps.connection.isConnected()) {
        return undefined;
    }

    return {
        code: "not_connected",
        message: "The ioBroker server is not connected.",
        hint: hint
    };
}
