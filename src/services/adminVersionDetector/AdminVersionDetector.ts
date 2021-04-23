import { AdminVersion } from "../../models/Config";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import * as socketio from 'socket.io-client';
import { IAdminVersionDetector } from "./IAdminVersionDetector";
import { ISocketIoClient } from "../socketIoClient/ISocketIoClient";


@injectable()
export class AdminVersionDetector implements IAdminVersionDetector {

    constructor(
        @inject(TYPES.services.socketIoClient) private socketIoClient: ISocketIoClient
    ) { }

    async getVersion(iobrokerUrl: string): Promise<AdminVersion> {
        if (await this.isAdmin4Reachable(iobrokerUrl)) {
            return AdminVersion.admin4;
        }

        if (await this.isAdmin5Reachable(iobrokerUrl)) {
            return AdminVersion.admin5;
        }

        return AdminVersion.unknown;
    }

    private isAdmin4Reachable(iobrokerUrl: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const client: SocketIOClient.Socket = socketio(iobrokerUrl);

            client.on("connect", () => {
                resolve(true);
                client.disconnect();
            });

            client.on("connect_error", () => {
                resolve(false);
                client.disconnect();
            });

            client.on("connect_timeout", () => {
                resolve(false);
                client.disconnect();
            });
        });
    }

    private isAdmin5Reachable(iobrokerUrl: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.socketIoClient.connect(iobrokerUrl, "");

            this.socketIoClient.on("connect", () => {
                resolve(true);
                this.socketIoClient.close();
            });

            this.socketIoClient.on("error", () => {
                resolve(false);
                this.socketIoClient.close();
            });
        });
    }
}
