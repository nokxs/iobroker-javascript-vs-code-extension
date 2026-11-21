import { ILogMessage } from "../../models/ILogMessage";
import { WorkspaceFolder } from "vscode";

export interface ILogMirrorService {
    open(workspaceFolder: WorkspaceFolder): Promise<void>;
    write(message: ILogMessage): void;
    /** True while a write stream is open (used to avoid reopen races). */
    isOpen(): boolean;
    dispose(): void;
    disposeAsync(): Promise<void>;
}
