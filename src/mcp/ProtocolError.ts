/**
 * A JSON-RPC error raised by the server's own guards, for example an unknown tool name.
 *
 * Deliberately not the SDK's `McpError`: its constructor builds the message as
 * `MCP error <code>: <text>`, and the SDK client does the same when it receives an error
 * response. A thrown `McpError` therefore reaches the client as
 * `MCP error -32602: MCP error -32602: <text>`. The SDK server serializes any thrown error with
 * a numeric `code` and its `message` as-is, so this class produces the prefix exactly once, on
 * the client side where it belongs.
 */
export class ProtocolError extends Error {
    constructor(readonly code: number, message: string) {
        super(message);
        this.name = "ProtocolError";
    }
}
