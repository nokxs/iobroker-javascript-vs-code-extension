export class Config {
    constructor(
        readonly ioBrokerUrl: String, 
        readonly socketIoPort: Number, 
        readonly workspaceSubPath: String,
        readonly scriptExplorer?: ScriptExplorerConfig) {}
}

export class ScriptExplorerConfig {
    constructor(
        readonly expandDirectoriesOnStartup?: boolean
    ) {}
}

export class NoConfig extends Config {
    constructor() {
        super("invalid", -1, "/");
    }
}
