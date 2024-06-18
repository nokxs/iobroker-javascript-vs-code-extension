import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ILoginCredentialsService } from "../services/loginCredentialsService/ILoginCredentialsService";
import { IConnectionServiceProvider } from "../services/connectionServiceProvider/IConnectionServiceProvider";

@injectable()
export class LogoutCommand implements ICommand {
    id: string = "iobroker-javascript.logout";
    
    constructor(
        @inject(TYPES.services.loginCredentials) private credentialsService: ILoginCredentialsService,
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider
    ) {}
    
    async execute() {
        this.credentialsService.deleteCredentials();
        await this.connectionServiceProvider.getConnectionService().disconnect();
    }
}
