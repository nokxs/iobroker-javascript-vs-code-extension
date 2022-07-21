export interface ILoginService {
    
    /**
     * Returns the login token.
     */
    login(username: string, password: string): Promise<string>
}