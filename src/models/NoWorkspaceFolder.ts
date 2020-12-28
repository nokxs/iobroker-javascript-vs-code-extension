import { Uri, WorkspaceFolder } from "vscode";

export class NoWorkspaceFolder implements WorkspaceFolder {
    uri: Uri = Uri.parse("file://");
    name: string = "INVALID";
    index: number = 0;
}