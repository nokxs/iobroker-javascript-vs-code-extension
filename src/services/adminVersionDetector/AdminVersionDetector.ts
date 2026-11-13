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

    async getVersion(iobrokerUrl: string, allowSelfSignedCertificate: boolean, accessToken?: string): Promise<AdminVersion> {
        if (await this.isAdmin4Reachable(iobrokerUrl)) {
            return AdminVersion.admin4;
        }

        return await this.determineAdminVersion(iobrokerUrl, allowSelfSignedCertificate, accessToken);
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

    private determineAdminVersion(iobrokerUrl: string, allowSelfSignedCertificate: boolean, accessToken?: string): Promise<AdminVersion> {
        return new Promise<AdminVersion>((resolve) => {
            const cleanUp = (version: AdminVersion) => {
                clearTimeout(timeout);
                // The socket client keeps its listeners across a reconnect, so this probe has to
                // remove them again; otherwise every later connect runs another getObject.
                this.socketIoClient.off("connect", onConnect);
                this.socketIoClient.off("error", onError);
                resolve(version);
            };

            const onConnect = () => {
                this.socketIoClient.emit("getObject", "system.adapter.admin", (err: any, state: { common?: { version?: string}}) => {
                    if (state?.common?.version?.startsWith("6")) {
                        cleanUp(AdminVersion.admin6);
                    }
                    else if (state?.common?.version?.startsWith("7")) {
                        cleanUp(AdminVersion.admin7);
                    }
                    else {
                        cleanUp(AdminVersion.admin5);
                    }
                });
            };

            const onError = () => cleanUp(AdminVersion.unknown);

            const timeout = setTimeout(() => cleanUp(AdminVersion.unknown), 5000);

            this.socketIoClient.on("connect", onConnect);
            this.socketIoClient.on("error", onError);

            if(accessToken) {
                this.socketIoClient.connect(iobrokerUrl, {cookie: accessToken}, allowSelfSignedCertificate);
            } else {
                this.socketIoClient.connect(iobrokerUrl, "", allowSelfSignedCertificate);
            }
        });
    }
}
