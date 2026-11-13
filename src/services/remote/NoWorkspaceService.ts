import type { WorkspaceFolder } from "vscode";
import { IWorkspaceService } from "../workspace/IWorkspaceService";

/** An empty fsPath is falsy, so the secret placeholder service never reads a `.env` file. */
const NO_WORKSPACE_FOLDER = <WorkspaceFolder><unknown>{
    uri: { fsPath: "" },
    name: "INVALID",
    index: 0
};

/**
 * The MCP server is remote-only and has no workspace. A structural literal is used instead of the
 * `NoWorkspaceFolder` model, which calls `Uri.parse` at runtime and would pull VS Code into the
 * bundle.
 */
export class NoWorkspaceService implements IWorkspaceService {
    workspaceToUse: WorkspaceFolder = NO_WORKSPACE_FOLDER;

    async getWorkspaceToUse(): Promise<WorkspaceFolder> {
        return this.workspaceToUse;
    }

    async getWorkspacesWithConfig(): Promise<WorkspaceFolder[]> {
        return [];
    }
}
