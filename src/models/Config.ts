export class Config {
    constructor(
        readonly ioBrokerUrl: string, 
        readonly socketIoPort: number,
        readonly scriptRoot: string,
        readonly adminVersion: AdminVersion,
        readonly scriptExplorer?: ScriptExplorerConfig) {}
}

export class ScriptExplorerConfig {
    constructor(
        readonly collapseDirectoriesOnStartup?: boolean
    ) {}
}

export class NoConfig extends Config {
    constructor() {
        super("invalid", -1, "/", AdminVersion.unknown);
    }
}

export enum AdminVersion {
    unknown = "Unknown",
    admin4 = "Admin4",
    admin5 = "Admin5"
}