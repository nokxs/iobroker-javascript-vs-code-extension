export class Config {
    constructor(
        readonly ioBrokerUrl: string, 
        readonly socketIoPort: number,
        readonly scriptRoot: string,
        readonly adminVersion: AdminVersion,
        readonly autoReconnect?: boolean,
        readonly scriptExplorer?: ScriptExplorerConfig,
        readonly allowSelfSignedCertificate?: boolean) {}
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
    unknown = "unknown",
    admin4 = "admin4",
    admin5 = "admin5"
}