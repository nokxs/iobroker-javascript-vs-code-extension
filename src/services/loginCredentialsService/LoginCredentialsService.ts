import { injectable, inject } from "inversify";
import { ExtensionContext, window } from "vscode";
import TYPES from "../../Types";
import { IAccessToken } from "./IAccessToken";
import { ILoginCredentialsService } from "./ILoginCredentialsService";

@injectable()
export class LoginCredentialsService implements ILoginCredentialsService {

    constructor(
        @inject(TYPES.extensionContext) private extensionContext: ExtensionContext
    ) {
    }

    async getPassword(): Promise<string | undefined> {
        const passwordFromStorage = await this.getPasswordFromStorage();
        if (passwordFromStorage) {
            return passwordFromStorage;
        }

        const passwordFromUser = await this.getPasswordFromUser();

        if (passwordFromUser) {
            this.updatePasswordInStorage(passwordFromUser);
        }

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

    private async updatePasswordInStorage(password: string): Promise<void> {
        await this.extensionContext.secrets.store("password", password);
    }

    private async invalidateCredentialsInStorage(): Promise<void>  {
        await this.extensionContext.secrets.delete("password");
        await this.extensionContext.secrets.delete("accessToken");
    }

    private async getPasswordFromStorage(): Promise<string | undefined> {
        return await this.extensionContext.secrets.get("password");
    }

    private async getPasswordFromUser(): Promise<string | undefined> {
        return await window.showInputBox({prompt: "Enter ioBroker password", password: true, ignoreFocusOut: true});
    }

    async getAccessToken(): Promise<IAccessToken | undefined> {
        const json = await this.extensionContext.secrets.get("accessToken");

        if (json) {
            return JSON.parse(json);
        }

        return undefined;
    }

    async updateAccessToken(accessToken: IAccessToken): Promise<void> {
        await this.extensionContext.secrets.store("accessToken", JSON.stringify(accessToken));
    }

    isValidAccessToken(accessToken: IAccessToken | undefined, serverTime: Date): boolean {
        if (accessToken && accessToken.token) {
            return serverTime < accessToken.expires;
        }

        return false;
    }
}