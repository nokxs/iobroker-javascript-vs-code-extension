export interface IConnectionEventListener {
    /** `reconnectAttempts` is set when an automatic reconnect succeeded. */
    onConnected(reconnectAttempts?: number): void
    onDisconnected(): void
    onReAuthenticate(): void
    /** Emitted right before `onDisconnected` when an established connection was lost. */
    onConnectionLost?(reason: string): void
    onReconnecting?(attempt: number, delayMs: number): void
}
