import { ExtensionContext } from "vscode";

export interface IAiToolService {
    /** Registers all language model tools of this extension. Safe to call once at startup. */
    registerTools(context: ExtensionContext): void

    /** Resolves the opt-in flag from `.iobroker-config.json` and starts watching the file. */
    initialize(context: ExtensionContext): Promise<void>

    /** Whether the user opted in to the AI tools. */
    isEnabled(): boolean

    updateContext(enabled: boolean): void

    /** Flips the flag in `.iobroker-config.json`. */
    toggle(): Promise<void>
}
