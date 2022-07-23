import { Uri } from "vscode"

export interface ILoginService {
    
    isLoginNecessary(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<boolean>
    
    /**
     * Tries to retreive the token from SecretStorage. If this fails, the user will be logged in.
     * Returns undefined if no valid token could be retreived.
     */
    getAccessToken(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string): Promise<string | undefined>

}