import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolOutcome } from "../aiTools/core/types";
import type { Logger } from "./Logger";

/**
 * `ToolOutcome` -> `CallToolResult`. Text content instead of `structuredContent`, because not
 * every client renders structured output and JSON in a text block works everywhere.
 *
 * Only errors are redacted. A successful payload is data the user asked for: masking a password
 * that happens to appear in a script source would corrupt it, and the next write would store the
 * mask instead of the source.
 */
export class ToolResultMapper {
    constructor(private readonly logger: Logger) { }

    toResult(outcome: ToolOutcome<unknown>): CallToolResult {
        if (outcome.ok) {
            return {
                content: [{ type: "text", text: JSON.stringify(outcome.data) }],
                isError: false
            };
        }

        return this.toErrorResult(outcome.error.code, outcome.error.message, outcome.error.hint);
    }

    toErrorResult(code: string, message: string, hint?: string): CallToolResult {
        const text = hint ? `${code}: ${message}\nHint: ${hint}` : `${code}: ${message}`;

        return {
            content: [{ type: "text", text: this.logger.redact(text) }],
            isError: true
        };
    }
}
