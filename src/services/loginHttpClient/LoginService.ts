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
            // At most cases an exception is expected, even if logging in is necessary
            // If Admin < 7.6.0 and authentication is disabled, an invalid token is received. We just 
            // assume that legacy is necessary in this case.
            return LoginType.legacy;
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
            // At most cases an exception is expected, even if logging in is necessary
            // If Admin < 7.6.0 and authentication is disabled, an invalid token is received. We just 
            // assume that legacy login is necessary in this case.
            return LoginType.legacy;
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
        this.logDebug("Getting access token from ioBroker with OAuth2");
        const postData = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&stayloggedin=true&client_id=ioBroker`;
        return this.getAccessTokenFromIoBroker(baseUri, LoginType.oAuth2, allowSelfSignedCertificate, postData, '/oauth/token');
    }

    private getLegacyAccessTokenFromIoBroker(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<IAccessToken> {
        this.logDebug("Getting access token from ioBroker with legacy method");
        const postData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&stayloggedin=on`;
        return this.getAccessTokenFromIoBroker(baseUri, LoginType.legacy, allowSelfSignedCertificate, postData, '/login');
    }

    private getAccessTokenFromIoBroker(
        baseUri: Uri, 
        loginType: LoginType,
        allowSelfSignedCertificate: boolean, 
        postData: string, 
        path: string): Promise<IAccessToken> {
        return new Promise((resolve, reject) => {
            const options = this.getLoginPostOptions(baseUri, path, allowSelfSignedCertificate, postData);
            const req = this.createRequest(baseUri, loginType, options, resolve, reject);

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    }

    private getLoginPostOptions(baseUri: Uri, path: string, allowSelfSignedCertificate: boolean, postData: string) {
        const portIndex = baseUri.authority.indexOf(":");
        const hostname = portIndex > 0 ? baseUri.authority.substring(0, portIndex) : baseUri.authority;
        const schemeDefaultPort = baseUri.scheme === "http" ? 80 : 443;
        const port = portIndex > 0 ? baseUri.authority.substring(portIndex + 1) : schemeDefaultPort;

        return {
            hostname: hostname,
            port: port,
            path: path,
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

    private async requestHandler(
        loginType: LoginType,
        res: http.IncomingMessage, 
        resolve: (value: IAccessToken) => void, 
        reject: (reason?: any) => void) {

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

        let connectToken: string | undefined = undefined;
        if (loginType === LoginType.oAuth2) {
            connectToken = `access_token=${this.getCookieValue(cookie, "access_token")}`;
        }
        else if (loginType === LoginType.legacy) {
            connectToken = `connect.sid=${this.getCookieValue(cookie, "connect.sid")}`;
            
        }
        else {
            throw new Error("Login type is not supported: " + loginType);
        }
        
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

    private createRequest(
        uri: Uri,
        loginType: LoginType, 
        options: http.RequestOptions, 
        resolve: (value: IAccessToken) => void, 
        reject: (reason?: any) => void): http.ClientRequest {

        if (uri.scheme === "http") {
            return http.request(options, res => this.requestHandler(loginType, res, resolve, reject));
        }

        return https.request(options, res => this.requestHandler(loginType, res, resolve, reject));
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