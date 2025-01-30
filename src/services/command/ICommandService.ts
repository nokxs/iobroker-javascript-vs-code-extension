import { ExtensionContext } from "vscode";

export interface ICommandService {
    registerCommands(context: ExtensionContext): void;
}