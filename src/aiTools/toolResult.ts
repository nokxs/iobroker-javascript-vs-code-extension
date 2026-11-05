import * as vscode from "vscode";
import { ToolOutcome } from "./core/types";

/**
 * Converts a tool outcome into a VS Code result. Failures are thrown as `Error` with the hint
 * appended, so the language model can correct its next call.
 */
export function toResult(outcome: ToolOutcome<unknown>): vscode.LanguageModelToolResult {
    if (!outcome.ok) {
        const error = outcome.error;
        const hint = error.hint ? ` ${error.hint}` : "";
        throw new Error(`${error.message}${hint} (${error.code})`);
    }

    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(outcome.data, null, 2))
    ]);
}
