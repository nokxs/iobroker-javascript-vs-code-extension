import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolOutcome } from "../aiTools/core/types";
import type { Logger } from "./Logger";

/**
 * `ToolOutcome` -> `CallToolResult`. Text content instead of `structuredContent`, because not
 * every client renders structured output and JSON in a text block works everywhere.
 */
export class ToolResultMapper {
    constructor(private readonly logger: Logger) { }

    toResult(outcome: ToolOutcome<unknown>): CallToolResult {
        if (outcome.ok) {
            return {
                content: [{ type: "text", text: this.logger.redact(JSON.stringify(outcome.data)) }],
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
