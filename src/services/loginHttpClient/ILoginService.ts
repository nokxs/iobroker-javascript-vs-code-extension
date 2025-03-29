import { Uri } from "vscode";
import { LoginType } from "./LoginType";

export interface ILoginService {
    
    getLoginType(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<LoginType>
    
    /**
     * Tries to retreive the token from SecretStorage. If this fails, the user will be logged in.
     * Returns undefined if no valid token could be retreived.
     */
    getAccessToken(
        baseUri: Uri, 
        allowSelfSignedCertificate: boolean, 
        username: string,
        loginType: LoginType,
    ): Promise<string | undefined>

}
