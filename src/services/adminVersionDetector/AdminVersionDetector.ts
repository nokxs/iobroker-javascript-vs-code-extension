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

    async getVersion(iobrokerUrl: string, allowSelfSignedCertificate: boolean): Promise<AdminVersion> {
        if (await this.isAdmin4Reachable(iobrokerUrl)) {
            return AdminVersion.admin4;
        }

        if (await this.isAdmin5Reachable(iobrokerUrl, allowSelfSignedCertificate)) {
            return AdminVersion.admin5;
        }

        return AdminVersion.unknown;
    }

    private isAdmin4Reachable(iobrokerUrl: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const client: SocketIOClient.Socket = socketio(iobrokerUrl);

            const timeout = setTimeout(() => {
                if(!this.socketIoClient.connected) {
                    resolve(false);
                }
            }, 5000);

            const cleanUp = () => {
                clearTimeout(timeout);
                client.disconnect();
            };

            client.on("connect", () => {
                cleanUp();
                resolve(true);
            });

            client.on("connect_error", () => {
                cleanUp();
                resolve(false);
            });

            client.on("connect_timeout", () => {
                cleanUp();
                resolve(false);
            });
        });
    }

    private isAdmin5Reachable(iobrokerUrl: string, allowSelfSignedCertificate: boolean): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.socketIoClient.connect(iobrokerUrl, "", allowSelfSignedCertificate);

            const timeout = setTimeout(() => {
                if(!this.socketIoClient.connected) {
                    resolve(false);
                }
            }, 5000);

            const cleanUp = () => {
                clearTimeout(timeout);
                this.socketIoClient.close;
            };

            this.socketIoClient.on("connect", () => {
                cleanUp();
                resolve(true);
            });

            this.socketIoClient.on("error", () => {
                cleanUp();
                resolve(false);
            });
        });
    }
}
