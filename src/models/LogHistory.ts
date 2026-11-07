import type { LogLevel } from "./LogLevel";

export interface LogHistoryOptions {
    hours: number
    maxRows: number
    before?: number
    level?: LogLevel
    source?: string
    search?: string
    controllerVersion?: string
}

export interface LogHistoryResult {
    entries: string[]
    scannedFiles: number
    scannedLines: number
    truncated: boolean
    until: number
    nextBefore: number | null
}
