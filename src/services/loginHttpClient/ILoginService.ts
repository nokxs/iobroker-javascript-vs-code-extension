import { Uri } from "vscode"

export interface ILoginService {
    
    isLoginNecessary(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<boolean>
    
    /**
     * Returns the login token.
     */
    login(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<string>

}