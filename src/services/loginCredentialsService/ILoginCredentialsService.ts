import { IAccessToken } from "./IAccessToken";
import { Uri } from "vscode";

export interface ILoginCredentialsService {
    
    getPassword(baseUri: Uri): Promise<string | undefined>
    updatePasswordFromUser(baseUri: Uri): Promise<string | undefined>

    getAccessToken(): Promise<IAccessToken | undefined>
    updateAccessToken(accessToken: IAccessToken): Promise<void>
    isValidAccessToken(accessToken: IAccessToken | undefined, serverTime: Date): boolean

    deleteCredentials(): Promise<void>
}
