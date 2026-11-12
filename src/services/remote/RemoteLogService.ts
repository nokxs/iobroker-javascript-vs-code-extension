import type { LogHost } from "../../aiTools/core/types";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";

/**
 * Builds the `logs` dependency of the remote core the same way `AiToolService.createDeps` does for
 * the extension.
 */
export class RemoteLogService {
    constructor(private readonly connectionServiceProvider: IConnectionServiceProvider) { }

    async getHosts(): Promise<LogHost[]> {
        const hosts = await this.connectionServiceProvider.getConnectionService()
            .getSystemObjectView<{ _id: string, common?: { name?: string } }>("host", "system.host", "system.host.");

        return hosts.map(host => ({
            id: host._id,
            name: host.common?.name ?? host._id.replace(/^system\.host\./, "")
        }));
    }

    getLogs(hostId: string, lines: number): Promise<string[]> {
        return this.connectionServiceProvider.getConnectionService().getLogs(hostId, lines);
    }
}
