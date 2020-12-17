import { Uri } from "vscode";

export class Config {
    constructor(readonly ioBrokerUrl: Uri, readonly workspaceSubPath: String){}
}
