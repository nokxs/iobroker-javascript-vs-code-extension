export const servConn: IoBrokerSocketConnection;

export interface IoBrokerSocketConnection {
    getType(): string;
    init(connOptions: ConnectionOptions, connCallbacks: ConnectionCallbacks, objectsRequired?: any, autoSubscribe?: boolean): void;
}

export interface ConnectionOptions {
    name: string;
    connLink: string;
    socketSession?: any;
}

export interface ConnectionCallbacks {
    onConnChange(isConnected: boolean): void;
    onRefresh(): void;
    onUpdate(id: string, state: string): void;
    onError(err: string): void;
}