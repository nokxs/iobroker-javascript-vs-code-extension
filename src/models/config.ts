import { Uri } from "vscode";

export class Config {
    constructor(readonly ioBrokerUrl: String, readonly socketIoPort: Number, readonly workspaceSubPath: String){}
}
