import * as vscode from "vscode";
import { ITool } from "../ITool";
import { ToolName } from "../schemas";
import { toResult } from "../toolResult";
import { ToolDeps, ToolOutcome } from "../core/types";

export interface InvocationDescription {
    title: string
    message: string
}

/**
 * Base class for the tool adapters. It keeps the adapters thin: the opt-in gate, the conversion
 * into VS Code types and the confirmation dialog live here, the logic lives in `core`.
 */
export abstract class BaseTool<TInput> implements ITool<TInput> {
    abstract readonly name: ToolName;

    /** Write tools change the script tree, read tools do not. */
    protected readonly changesScripts: boolean = false;

    constructor(
        protected readonly deps: ToolDeps,
        private readonly isEnabled: () => boolean,
        private readonly refreshTree: () => void
    ) {}

    protected abstract run(input: TInput): Promise<ToolOutcome<unknown>>;

    /**
     * Write tools describe the pending change. Read tools return `undefined` and get the default
     * confirmation message of VS Code.
     */
    // eslint-disable-next-line no-unused-vars
    protected describe(_input: TInput): InvocationDescription | undefined {
        return undefined;
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<TInput>): Promise<vscode.LanguageModelToolResult> {
        // The `when` clause only hides the tool in the UI. The tool stays registered and can still
        // be invoked by other chat participants, so the opt-in has to be enforced here as well.
        if (!this.isEnabled()) {
            throw new Error("The ioBroker MCP server is disabled. Ask the user to run the command 'iobroker: Enable/disable MCP server (AI tools)' and retry afterwards.");
        }

        const outcome = await this.run(options.input ?? <TInput>{});

        if (outcome.ok && this.changesScripts) {
            this.refreshTree();
        }

        return toResult(outcome);
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TInput>): vscode.PreparedToolInvocation | undefined {
        const description = this.describe(options.input ?? <TInput>{});
        if (!description) {
            return undefined;
        }

        return {
            invocationMessage: description.title,
            confirmationMessages: {
                title: description.title,
                message: new vscode.MarkdownString(description.message)
            }
        };
    }
}
