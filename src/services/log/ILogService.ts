
export interface ILogService {
    startReceiving(): Promise<void>;
    stopReceiving(): Promise<void>;
    dispose(): void;
}
