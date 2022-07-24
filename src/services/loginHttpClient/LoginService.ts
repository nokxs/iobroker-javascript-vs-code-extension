import * as http from 'http';
import * as https from 'https';

import { ILoginService } from "./ILoginService";
import axios from 'axios';
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { Uri } from 'vscode';
import { IAccessToken } from '../loginCredentialsService/IAccessToken';
import { ILoginCredentialsService } from '../loginCredentialsService/ILoginCredentialsService';

@injectable()
export class LoginService implements ILoginService {

    constructor(
        @inject(TYPES.services.loginCredentials) private loginCredentialService: ILoginCredentialsService
    ) { }

    async isLoginNecessary(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<boolean> {
        const httpsAgent = this.createHttpsAgent(allowSelfSignedCertificate);
        const loginUri = baseUri.with({ path: "login" }).toString();

        try {
            const result = await axios.get(loginUri, { httpsAgent: httpsAgent });
            if (result.status === 200 && result.headers["set-cookie"]) {
                return true;
            }
        } catch (error) {
            return false;
        }

        return false;
    }

    async getAccessToken(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string): Promise<string | undefined> {
        const accessToken = await this.loginCredentialService.getAccessToken();
        const serverTime = await this.getServerTime(baseUri, allowSelfSignedCertificate);

        // check if the retreived token is still valid
        if (accessToken && this.loginCredentialService.isValidAccessToken(accessToken, serverTime)) {
            return accessToken.token;
        }

        // token was not valid. Get password form store or user
        const password = await this.loginCredentialService.getPassword();
        if (!password) {
            return undefined;
        }

        // get new token with retreived password
        const newAccessToken = await this.getAndUpdateToken(baseUri, allowSelfSignedCertificate, username, password, serverTime);
        if (newAccessToken) {
            return newAccessToken.token;
        }

        // could not get new token with the password. Ask the user to supply a new one
        const newPassword = await this.loginCredentialService.updatePasswordFromUser();
        if (!newPassword) {
            return undefined;
        }

        // try to get a new token with the updated password
        const updatedAccessToken = await this.getAndUpdateToken(baseUri, allowSelfSignedCertificate, username, password, serverTime);
        return updatedAccessToken?.token ?? undefined;

    }

    private async getAndUpdateToken(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string, serverTime: Date): Promise<IAccessToken | undefined> {
        const newAccessToken = await this.login(baseUri, allowSelfSignedCertificate, username, password);

        if (this.loginCredentialService.isValidAccessToken(newAccessToken, serverTime)) {
            this.loginCredentialService.updateAccessToken(newAccessToken);
            return newAccessToken;
        }

        return undefined;
    }

    private async getServerTime(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<Date> {
        const httpsAgent = this.createHttpsAgent(allowSelfSignedCertificate);
        const response = await axios.get(baseUri.toString(), { httpsAgent: httpsAgent });
        const dateHeader = response.headers.date;

        if (dateHeader) {
            return new Date(dateHeader);
        }

        return new Date();
    }

    private login(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<IAccessToken> {
        return new Promise((resolve, reject) => {
            const postData = `username=${username}&password=${password}&stayloggedin=on`;
            const options = this.getLoginPostOptions(baseUri, allowSelfSignedCertificate, postData);
            const req = this.createRequest(baseUri, options, resolve, reject);

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    }

    private getLoginPostOptions(baseUri: Uri, allowSelfSignedCertificate: boolean, postData: string) {
        const portIndex = baseUri.authority.indexOf(":");
        const hostname = portIndex > 0 ? baseUri.authority.substring(0, portIndex) : baseUri.authority;
        const schemeDefaultPort = baseUri.scheme === "http" ? 80 : 443;
        const port = portIndex > 0 ? baseUri.authority.substring(portIndex + 1) : schemeDefaultPort;

        return {
            hostname: hostname,
            port: port,
            path: '/login',
            method: 'POST',
            rejectUnauthorized: !allowSelfSignedCertificate,
            requestCert: true,
            agent: false,
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/x-www-form-urlencoded',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Length': postData.length
            }
        };
    }

    private async requestHandler(res: http.IncomingMessage, resolve: (value: IAccessToken) => void, reject: (reason?: any) => void) {

        if (res.statusCode && res.statusCode !== 200 && res.statusCode !== 302) {
            reject(`Login failed. Received status code '${res.statusCode}'`);
        }

        var cookies = res.headers["set-cookie"] ?? [];

        if (cookies.length !== 1) {
            reject("Cookie was not set");
            return;
        }

        const cookie = cookies[0];

        const connectToken = `connect.sid=${this.getCookieValue(cookie, "connect.sid")}`;
        const expires = new Date(this.getCookieValue(cookie, "Expires"));

        const accessToken: IAccessToken = { token: connectToken, expires: expires };

        resolve(accessToken);
    }

    private getCookieValue(cookie: string, identifier: string): string {
        const startIndex = cookie.indexOf(identifier);
        const startSubString = cookie.substring(startIndex + identifier.length + 1); // +1 is the equal sign
        const endIndex = startSubString.indexOf(";");
        return startSubString.substring(0, endIndex);
    }

    private createRequest(uri: Uri, options: http.RequestOptions, resolve: (value: IAccessToken) => void, reject: (reason?: any) => void): http.ClientRequest {

        if (uri.scheme === "http") {
            return http.request(options, res => this.requestHandler(res, resolve, reject));
        }

        return https.request(options, res => this.requestHandler(res, resolve, reject));
    }

    private createHttpsAgent(allowSelfSignedCertificate: boolean) {
        return new https.Agent({
            rejectUnauthorized: !allowSelfSignedCertificate
        });
    }
}