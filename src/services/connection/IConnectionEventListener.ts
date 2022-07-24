export interface IConnectionEventListener {
    onConnected(): void
    onDisconnected(): void
    onReAuthenticate(): void
}
