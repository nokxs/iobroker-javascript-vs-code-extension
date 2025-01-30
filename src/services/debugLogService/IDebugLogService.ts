const DEBUG_LOG_SEVERITY = {
    info: "INFO",
    warning: "WARN",
    error: "ERROR"
};

export default DEBUG_LOG_SEVERITY;

export interface IDebugLogService {
    startCollecting(): Promise<void>
    stopCollecting(): void
    isCollecting(): boolean

    log(message: string, source?: string, severity?: string): void
    logWarning(message: string, source?: string): void
    logError(message: string, source?: string): void
}
