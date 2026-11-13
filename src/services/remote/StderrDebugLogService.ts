import type { ILogger } from "../../mcp/Logger";
import DEBUG_LOG_SEVERITY, { IDebugLogService } from "../debugLogService/IDebugLogService";

/**
 * `SocketIoClient` and `LoginService` log through this service. The messages go to stderr through
 * the redacting `Logger`, so they cannot corrupt the JSON-RPC stream on stdout.
 */
export class StderrDebugLogService implements IDebugLogService {
    constructor(private readonly logger: ILogger) { }

    async startCollecting(): Promise<void> {
        // The MCP server never writes a debug log file.
    }

    stopCollecting(): void {
        // see startCollecting
    }

    isCollecting(): boolean {
        return false;
    }

    log(message: string, source?: string, severity?: string): void {
        this.logger.debug(`${severity ?? DEBUG_LOG_SEVERITY.info} ${source ?? ""} ${message}`.trim());
    }

    logWarning(message: string, source?: string): void {
        this.logger.warn(`${source ?? ""} ${message}`.trim());
    }

    logError(message: string, source?: string): void {
        this.logger.error(`${source ?? ""} ${message}`.trim());
    }
}
