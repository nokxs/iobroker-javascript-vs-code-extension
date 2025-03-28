import * as http from 'http';
import * as https from 'https';

import { ILoginService } from "./ILoginService";
import axios from 'axios';
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { Uri } from 'vscode';
import { IAccessToken } from '../loginCredentialsService/IAccessToken';
import { ILoginCredentialsService } from '../loginCredentialsService/ILoginCredentialsService';
import { IDebugLogService } from '../debugLogService/IDebugLogService';
import { IConfigRepositoryService } from '../configRepository/IConfigRepositoryService';
import { LoginType } from './LoginType';

interface ILoginError {
    message: string;
    isLoginUrlAvailable: boolean;
}

@injectable()
export class LoginService implements ILoginService {

    constructor(
        @inject(TYPES.services.loginCredentials) private loginCredentialService: ILoginCredentialsService,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,
        @inject(TYPES.services.configRepository) private configRepository: IConfigRepositoryService
    ) { }

    async getLoginType(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<LoginType> {
        try {
            await this.getOAuthAccessTokenFromIoBroker(baseUri, allowSelfSignedCertificate, "", "");
            // An exception is expected, even if logging in is necessary
        }
        catch (error: ILoginError | unknown) {
            if (error && typeof error === "object" && "isLoginUrlAvailable" in error) {
                if (error.isLoginUrlAvailable) {
                    return LoginType.oAuth2;
                }
            }
        }        
        
        try {
            await this.getLegacyAccessTokenFromIoBroker(baseUri, allowSelfSignedCertificate, "", "");
            // An exception is expected, even if logging in is necessary
        }
        catch (error: ILoginError | unknown) {
            if (error && typeof error === "object" && "isLoginUrlAvailable" in error) {
                if (error.isLoginUrlAvailable) {
                    return LoginType.legacy;
                }
            }
        }
        
        return LoginType.noLogin;
    }

    async getAccessToken(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, loginType: LoginType): Promise<string | undefined> {
        const config = this.configRepository.config;
        console.log(config.ioBrokerUrl);
        
        const accessToken = await this.loginCredentialService.getAccessToken();
        const serverTime = await this.getServerTime(baseUri, allowSelfSignedCertificate);

        // check if the retreived token is still valid
        if (accessToken && this.loginCredentialService.isValidAccessToken(accessToken, serverTime)) {
            this.logDebug("Found valid access token. Using it");
            return accessToken.token;
        }

        // token was not valid. Get password form store or user
        const password = await this.loginCredentialService.getPassword();
        if (!password) {
            this.logDebug("User did not provide password. Cannot get access token");
            return undefined;
        }

        // get new token with retreived password
        const newAccessToken = await this.getAndUpdateToken(baseUri, allowSelfSignedCertificate, username, password, serverTime, loginType);
        if (newAccessToken) {
            this.logDebug("Successfuly got new access token. Using it");
            return newAccessToken.token;
        }

        // could not get new token with the password. Ask the user to supply a new one
        const newPassword = await this.loginCredentialService.updatePasswordFromUser();
        this.logDebug("Could not get new token with the password. Ask the user to supply a new one");
        if (!newPassword) {
            this.logDebug("User did not provide password. Cannot get access token");
            return undefined;
        }

        // try to get a new token with the updated password
        const updatedAccessToken = await this.getAndUpdateToken(baseUri, allowSelfSignedCertificate, username, password, serverTime, loginType);
        return updatedAccessToken?.token ?? undefined;

    }

    private async getAndUpdateToken(
        baseUri: Uri, 
        allowSelfSignedCertificate: boolean, 
        username: string, 
        password: string, 
        serverTime: Date,
        loginType: LoginType
    ): Promise<IAccessToken | undefined> {

        let newAccessToken;
        if (loginType === LoginType.oAuth2) {
            newAccessToken = await this.getOAuthAccessTokenFromIoBroker(baseUri, allowSelfSignedCertificate, username, password);
        }
        else if (loginType === LoginType.legacy) {
            newAccessToken = await this.getLegacyAccessTokenFromIoBroker(baseUri, allowSelfSignedCertificate, username, password);
        }
        else {
            throw new Error("Login type is not supported: " + loginType);
        }

        if (this.loginCredentialService.isValidAccessToken(newAccessToken, serverTime)) {
            await this.loginCredentialService.updateAccessToken(newAccessToken);
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

    private getOAuthAccessTokenFromIoBroker(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<IAccessToken> {
         return new Promise((resolve, reject) => {
            const postData = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&stayloggedin=true&client_id=ioBroker`;
            const options = this.getLoginPostOptionsForOAuth(baseUri, allowSelfSignedCertificate, postData);
            const req = this.createRequest(baseUri, options, resolve, reject);

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    }

    private getLegacyAccessTokenFromIoBroker(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<IAccessToken> {
        return new Promise((resolve, reject) => {
            const postData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&stayloggedin=on`;
            const options = this.getLegacyLoginPostOptions(baseUri, allowSelfSignedCertificate, postData);
            const req = this.createRequest(baseUri, options, resolve, reject);

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    }

    private getLegacyLoginPostOptions(baseUri: Uri, allowSelfSignedCertificate: boolean, postData: string) {
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

    
    private getLoginPostOptionsForOAuth(baseUri: Uri, allowSelfSignedCertificate: boolean, postData: string) {
        const portIndex = baseUri.authority.indexOf(":");
        const hostname = portIndex > 0 ? baseUri.authority.substring(0, portIndex) : baseUri.authority;
        const schemeDefaultPort = baseUri.scheme === "http" ? 80 : 443;
        const port = portIndex > 0 ? baseUri.authority.substring(portIndex + 1) : schemeDefaultPort;

        return {
            hostname: hostname,
            port: port,
            path: '/oauth/token',
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
            const result: ILoginError = { 
                message: `Login failed. Received status code '${res.statusCode}'`,
                isLoginUrlAvailable: res.statusCode === 400
            };
            reject(result);
            return;
        }

        var cookies = res.headers["set-cookie"] ?? [];

        if (cookies.length !== 1) {
            const result = { 
                message: `Cookie was not set`,
                isLoginUrlAvailable: res.statusCode === 400
            };
            reject(result);
            return;
        }

        const cookie = cookies[0];

        // const connectToken = `connect.sid=${this.getCookieValue(cookie, "connect.sid")}`;
        const connectToken = `access_token=${this.getCookieValue(cookie, "access_token")}`;
        const expires = new Date(this.getCookieValue(cookie, "Expires"));

        this.logDebug(`Got new access token which expires on ${expires}`);

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

    private logDebug(message: string) {
        this.debugLogService.log(message, "LoginService");
    }
}