
export interface ILogService {
    startReceiving(): Promise<void>;
    stopReceiving(): Promise<void>;
    /** Re-open the workspace log mirror after an auto-reconnect without re-registering socket listeners. */
    reopenMirror(): Promise<void>;
    dispose(): void;
    disposeAsync(): Promise<void>;
}
