export class Config {
    constructor(
        readonly ioBrokerUrl: string, 
        readonly socketIoPort: number,
        readonly scriptRoot: string,
        readonly adminVersion: AdminVersion,
        readonly autoReconnect?: boolean,
        readonly scriptExplorer?: ScriptExplorerConfig,
        readonly allowSelfSignedCertificate?: boolean,
        readonly username?: string,
        readonly collectDebugLog?: boolean,
        readonly autoUpload?: boolean,
        readonly scriptAutoRun?: boolean,
        readonly forceLogin?: boolean,
        readonly iobrokerNodeTypesVersion?: string) {}
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
    admin5 = "admin5",
    admin6 = "admin6",
    admin7 = "admin7"
}