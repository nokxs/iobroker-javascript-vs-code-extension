export interface ISocketIoClient {
    connected: boolean;
    autoReconnect: boolean;

    connect(_url: any, _options: any, allowSelfSignedCertificate: boolean): Promise<ISocketIoClient>;
    withCallback(name: String, id: any, args: any, cb: any): void;
    findAnswer(id: any, args: any): void;
    emit(name: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void;
    on(name: any, cb: any): void;
    off(name: any, cb?: any): void;
    close(): Promise<ISocketIoClient>;
}
