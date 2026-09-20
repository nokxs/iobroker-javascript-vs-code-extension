import { injectable, inject } from "inversify";
import { ExtensionContext, window } from "vscode";
import TYPES from "../../Types";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { IAccessToken } from "./IAccessToken";
import { ILoginCredentialsService } from "./ILoginCredentialsService";

@injectable()
export class LoginCredentialsService implements ILoginCredentialsService {

    private static readonly secretPassword = "password";
    private static readonly secretToken = "accessToken";

    constructor(
        @inject(TYPES.extensionContext) private extensionContext: ExtensionContext,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,        
        @inject(TYPES.services.configRepository) private configRepository: IConfigRepositoryService
    ) { }

    async getPassword(): Promise<string | undefined> {
        const passwordFromStorage = await this.getPasswordFromStorage();
        if (passwordFromStorage) {
            this.debugLogService.log("GetPassword: Get password from storage", "LoginCredentials");
            return passwordFromStorage;
        }

        const passwordFromUser = await this.getPasswordFromUser();
        if (passwordFromUser) {
            this.updatePasswordInStorage(passwordFromUser);
        }

        this.debugLogService.log("GetPassword: Return password from user", "LoginCredentials");
        return passwordFromUser;
    }

    async updatePasswordFromUser(): Promise<string | undefined> {
        await this.invalidateCredentialsInStorage();
        
        const password = await this.getPasswordFromUser();
        if (password) {
            await this.updatePasswordInStorage(password);            
        }

        return password;
    }

    async deleteCredentials(): Promise<void> {
        await this.invalidateCredentialsInStorage();
    }

    async getAccessToken(): Promise<IAccessToken | undefined> {
        const json = await this.extensionContext.secrets.get(this.getAccessTokenIdentifier());

        if (json) {
            return JSON.parse(json);
        }

        return undefined;
    }

    async updateAccessToken(accessToken: IAccessToken): Promise<void> {
        await this.extensionContext.secrets.store(this.getAccessTokenIdentifier(), JSON.stringify(accessToken));
    }

    isValidAccessToken(accessToken: IAccessToken | undefined, serverTime: Date): boolean {
        if (accessToken && accessToken.token) {
            return serverTime < accessToken.expires;
        }

        return false;
    }

    private async updatePasswordInStorage(password: string): Promise<void> {
        this.debugLogService.log("Update password in storage", "LoginCredentials");
        await this.extensionContext.secrets.store(this.getPasswordIdentifier(), password);
    }

    private async invalidateCredentialsInStorage(): Promise<void>  {
        this.debugLogService.log("Invalidate credentials", "LoginCredentials");
        await this.extensionContext.secrets.delete(this.getPasswordIdentifier());
        await this.extensionContext.secrets.delete(this.getAccessTokenIdentifier());
    }

    private async getPasswordFromStorage(): Promise<string | undefined> {
        return await this.extensionContext.secrets.get(this.getPasswordIdentifier());
    }

    private async getPasswordFromUser(): Promise<string | undefined> {
        this.debugLogService.log("Get password from user", "LoginCredentials");
        return await window.showInputBox({prompt: "Enter ioBroker password", password: true, ignoreFocusOut: true});
    }

    private getPasswordIdentifier(): string {
        const config = this.configRepository.config;
        return LoginCredentialsService.secretPassword + config.ioBrokerUrl + config.socketIoPort;
    }

    private getAccessTokenIdentifier(): string {
        const config = this.configRepository.config;
        return LoginCredentialsService.secretToken + config.ioBrokerUrl + config.socketIoPort;
    }
}
