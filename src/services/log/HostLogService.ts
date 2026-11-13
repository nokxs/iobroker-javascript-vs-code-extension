import type { LogHost } from "../../aiTools/core/types";
import type { LogSource } from "../../aiTools/core/logs";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";

/**
 * The `logs` dependency of the AI tools: hosts come from the ioBroker object view, the log tail
 * from a host command. One implementation for the extension and the MCP server.
 */
export class HostLogService implements LogSource {
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
