import { IAccessToken } from "../loginCredentialsService/IAccessToken";
import { ILoginCredentialsService } from "../loginCredentialsService/ILoginCredentialsService";

/**
 * Credentials for the MCP server: the password comes from the environment and is never stored,
 * the access token is kept in memory only. The user is never prompted.
 */
export class EnvLoginCredentialsService implements ILoginCredentialsService {
    private accessToken: IAccessToken | undefined;

    constructor(private readonly password: string | undefined) { }

    async getPassword(): Promise<string | undefined> {
        return this.password;
    }

    async updatePasswordFromUser(): Promise<string | undefined> {
        // There is no UI in a stdio server. The bounded login retry reports the failure instead.
        return undefined;
    }

    async getAccessToken(): Promise<IAccessToken | undefined> {
        return this.accessToken;
    }

    async updateAccessToken(accessToken: IAccessToken): Promise<void> {
        this.accessToken = accessToken;
    }

    isValidAccessToken(accessToken: IAccessToken | undefined, serverTime: Date): boolean {
        if (!accessToken || !accessToken.token || !(accessToken.expires instanceof Date)) {
            return false;
        }

        return !Number.isNaN(accessToken.expires.getTime()) && serverTime < accessToken.expires;
    }

    async deleteCredentials(): Promise<void> {
        this.accessToken = undefined;
    }
}
