import { commands } from "vscode";
import CONSTANTS from "../../Constants";
import { IStatusBarService } from "../statusBar/IStatusBarService";

/** Values of the context key `iobroker-javascript.connectionState`, used by the `viewsWelcome` when clauses. */
export type ConnectionState = "disconnected" | "connecting" | "reconnecting" | "loading" | "connected" | "loadFailed";

/** Keeps the status bar text and the connection state context key in sync. */
export class ConnectionStatusPresenter {
    private state: ConnectionState = "disconnected";
    private indexingObjects = false;
    private reconnectInfo = "";

    constructor(private statusBarService: IStatusBarService) {}

    get current(): ConnectionState {
        return this.state;
    }

    set(state: ConnectionState): void {
        this.state = state;
        this.render();
        void commands.executeCommand("setContext", CONSTANTS.contexts.connectionState, state);
    }

    setReconnecting(attempt: number, delayMs: number): void {
        this.reconnectInfo = `attempt ${attempt}, next in ${Math.round(delayMs / 1000)}s`;
        this.set("reconnecting");
    }

    setIndexingObjects(indexing: boolean): void {
        this.indexingObjects = indexing;
        this.render();
    }

    private render(): void {
        this.statusBarService.setText(this.textFor(this.state));
    }

    private textFor(state: ConnectionState): string {
        switch (state) {
            case "disconnected":
                return "$(warning) ioBroker disconnected";
            case "connecting":
                return "$(sync~spin) ioBroker connecting...";
            case "reconnecting":
                return `$(sync~spin) ioBroker reconnecting (${this.reconnectInfo})`;
            case "loading":
                return "$(sync~spin) ioBroker connected - loading scripts...";
            case "loadFailed":
                return "$(warning) ioBroker connected - script list failed (click to retry)";
            case "connected":
                return this.indexingObjects ? "$(check) ioBroker connected - indexing objects..." : "$(check) ioBroker connected";
        }
    }
}
