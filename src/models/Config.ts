export class Config {
    constructor(
        readonly ioBrokerUrl: string, 
        readonly socketIoPort: number, 
        readonly scriptRoot: string,
        readonly scriptExplorer?: ScriptExplorerConfig) {}
}

export class ScriptExplorerConfig {
    constructor(
        readonly collapseDirectoriesOnStartup?: boolean
    ) {}
}

export class NoConfig extends Config {
    constructor() {
        super("invalid", -1, "/");
    }
}
