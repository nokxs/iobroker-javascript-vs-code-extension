import { ToolDeps, ToolError } from "./types";

/**
 * The concrete connection service opens quick picks and a login prompt when it is called.
 * Tools must never do that, so they only report the missing connection.
 */
export function ensureConnected(deps: ToolDeps): ToolError | undefined {
    if (deps.connection.isConnected()) {
        return undefined;
    }

    return {
        code: "not_connected",
        message: "The ioBroker server is not connected.",
        hint: "Ask the user to run the command 'iobroker: Connect to ioBroker' and retry afterwards."
    };
}
