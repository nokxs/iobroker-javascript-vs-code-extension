import { IAccessToken } from "./IAccessToken";

export interface ILoginCredentialsService {
    
    getPassword(): Promise<string | undefined>
    updatePasswordFromUser(): Promise<string | undefined>

    getAccessToken(): Promise<IAccessToken | undefined>
    updateAccessToken(accessToken: IAccessToken): Promise<void>
    isValidAccessToken(accessToken: IAccessToken | undefined, serverTime: Date): boolean
}