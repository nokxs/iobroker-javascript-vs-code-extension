import * as vscode from "vscode";
import { ToolName } from "./schemas";

/** A language model tool of this extension. `name` matches the entry in package.json. */
export interface ITool<T> extends vscode.LanguageModelTool<T> {
    readonly name: ToolName
}
