export class Config {
    constructor(
        readonly ioBrokerUrl: string, 
        readonly socketIoPort: number, 
        readonly workspaceSubPath: string,
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
