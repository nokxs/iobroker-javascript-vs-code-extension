import { ILogMessage } from "../../models/ILogMessage";
import { WorkspaceFolder } from "vscode";

export interface ILogMirrorService {
    open(workspaceFolder: WorkspaceFolder): Promise<void>;
    write(message: ILogMessage): void;
    dispose(): void;
    disposeAsync(): Promise<void>;
}
