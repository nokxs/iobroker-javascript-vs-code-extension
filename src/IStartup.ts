import { ExtensionContext } from "vscode";

export interface IStartup {
    init(context: ExtensionContext): Promise<void>
}
