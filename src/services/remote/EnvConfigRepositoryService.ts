import { AdminVersion, Config } from "../../models/Config";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";

/** The values the MCP server takes from the environment to build the ioBroker config. */
export interface RemoteConfigSource {
    ioBrokerUrl: string
    socketIoPort: number
    username?: string
    allowSelfSignedCertificate: boolean
    scriptAutoRun: boolean
}

/**
 * `IConfigRepositoryService` without a workspace: the configuration is built from the environment
 * once, and `adminVersion` is filled in by the first connect (section 10.1 of the design).
 */
export class EnvConfigRepositoryService implements IConfigRepositoryService {
    config: Config;

    constructor(private readonly source: RemoteConfigSource) {
        this.config = this.toConfig(AdminVersion.unknown);
    }

    setAdminVersion(adminVersion: AdminVersion): void {
        this.config = this.toConfig(adminVersion);
    }

    async read(): Promise<Config> {
        return this.config;
    }

    async write(): Promise<void> {
        throw new Error("The MCP server does not write a configuration file. Use the environment variables instead.");
    }

    private toConfig(adminVersion: AdminVersion): Config {
        return new Config(
            this.source.ioBrokerUrl,
            this.source.socketIoPort,
            "",
            adminVersion,
            true,
            undefined,
            this.source.allowSelfSignedCertificate,
            this.source.username,
            false,
            false,
            this.source.scriptAutoRun,
            true,
            undefined,
            true);
    }
}
