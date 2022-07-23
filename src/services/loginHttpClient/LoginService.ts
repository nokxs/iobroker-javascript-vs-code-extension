import * as http from 'http';
import * as https from 'https';

import { ILoginService } from "./ILoginService";
import axios from 'axios';
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { LoginCredentialsService } from '../loginCredentialsService/LoginCredentialsService';
import { Uri } from 'vscode';

@injectable()
export class LoginService implements ILoginService {

    constructor(
        @inject(TYPES.services.loginCredentials) private loginCredentialService: LoginCredentialsService
    ) {
    }

    async isLoginNecessary(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<boolean> {
        const httpsAgent = this.createHttpsAgent(allowSelfSignedCertificate);
        const loginUri = baseUri.with({ path: "login" }).toString();
        const result = await axios.get(loginUri, { httpsAgent: httpsAgent });

        if (result.status === 200) {
            return true;
        }
        else if (result.status === 302) {
            return false;
        }

        throw new Error(`Could not determine if login was needed, because of unhandled status code ${result.status}`);
    }

    async getAccessToken(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string): Promise<string | undefined> {
        const accessToken = await this.loginCredentialService.getAccessToken();
        const serverTime = await this.getServerTime(baseUri, allowSelfSignedCertificate);

        if (accessToken && this.loginCredentialService.isValidAccessToken(accessToken, serverTime)) {
            return accessToken.token;
        }

        const password = await this.loginCredentialService.getPassword();
        if (!password) {
            return undefined;
        }

        const newAccessToken = await this.login(baseUri, allowSelfSignedCertificate, username, password);

        if (this.loginCredentialService.isValidAccessToken(newAccessToken, serverTime)) {
            this.loginCredentialService.updateAccessToken(newAccessToken);
            return newAccessToken.token;
        }

        return undefined;
    }

    private async getServerTime(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<Date> {
        const httpsAgent = this.createHttpsAgent(allowSelfSignedCertificate);
        const response = await axios.get(baseUri.toString(), { httpsAgent: httpsAgent });
        const dateHeader = response.headers.get("Date");

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
                'Content-Type': 'application/x-www-form-urlencoded',
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

        const startIndex = cookie.indexOf("connect.sid");
        const startSubString = cookie.substring(startIndex);
        const endIndex = startSubString.indexOf(";");
        const connectToken = startSubString.substring(0, endIndex);

        // TODO: parse date
        const accessToken: IAccessToken = { token: connectToken, expires: new Date() };

        resolve(accessToken);
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