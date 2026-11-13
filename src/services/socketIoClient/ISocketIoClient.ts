import { ConnectionTimeouts } from "./ConnectionTimeouts";

/**
 * Events emitted besides the server events:
 * - `connect` / `reconnect(true, attempts)`: `___ready___` received
 * - `disconnect`: an established connection was lost or closed
 * - `connectionLost(reason)`: emitted right before `disconnect` with a human readable reason
 * - `reconnecting(attempt, delayMs)`: a reconnect attempt was scheduled
 * - `error(message)`
 */
export interface ISocketIoClient {
    connected: boolean;
    autoReconnect: boolean;

    configure(timeouts: ConnectionTimeouts): void;
    connect(_url: any, _options: any, allowSelfSignedCertificate: boolean): Promise<ISocketIoClient>;
    withCallback(name: String, id: any, args: any, cb: any): void;
    findAnswer(id: any, args: any): void;
    emit(name: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void;
    on(name: any, cb: any): void;
    off(name: any, cb?: any): void;
    /** Skips the backoff wait of a scheduled reconnect, keeping all handlers and the session state. */
    reconnectNow(): void;
    /** Closes the connection and stops reconnecting. Registered handlers are kept. */
    close(): Promise<ISocketIoClient>;
}
