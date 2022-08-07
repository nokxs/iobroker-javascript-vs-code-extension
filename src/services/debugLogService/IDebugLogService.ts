
export interface IDebugLogService {
    startCollecting(): void
    stopCollecting(): void
    isCollecting(): boolean

    log(message: string): void
}
