export class Config {
    constructor(readonly ioBrokerUrl: String, readonly socketIoPort: Number, readonly workspaceSubPath: String){}
}

export class NoConfig extends Config {
    constructor() {
        super("http://invalid", 8081, "/");
    }
}
