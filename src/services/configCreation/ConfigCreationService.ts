import { AdminVersion, Config, NoConfig } from "../../models/Config";
import { Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { ITypeDefinitionService } from '../typeDefinition/ITypeDefinitionService';
import { IConfigCreationService } from "./IConfigCreationService";
import { IAdminVersionDetector } from "../adminVersionDetector/IAdminVersionDetector";
import { ILoginService } from "../loginHttpClient/ILoginService";

@injectable()
export class ConfigCreationService implements IConfigCreationService {
    
    constructor(
        @inject(TYPES.services.typeDefinition) private typeDefinitionService: ITypeDefinitionService,
        @inject(TYPES.services.adminVersionDetector) private adminVersionDetector: IAdminVersionDetector,
        @inject(TYPES.services.login) private loginService: ILoginService
    ) {}

    async createConfigInteractivly(): Promise<Config> {
        let ioBrokerUrl = await window.showInputBox({prompt: "The URL to your ioBroker installation", value: "http://localhost", ignoreFocusOut: true});
        if (!ioBrokerUrl) {
            return new NoConfig();
        }
        else if (!(ioBrokerUrl.startsWith("http://") || ioBrokerUrl.startsWith("https://"))) {
            await window.showWarningMessage("The ioBroker URL has to start with 'http://' or 'https://'");
            return new NoConfig();
        }

        let port: string | undefined;
        let allowSelfSignedCertificate = false;
        const portRegex = new RegExp("(http.*):(\\d+)");
        const portMatch = portRegex.exec(ioBrokerUrl);
        if (portMatch && (portMatch?.length ?? 0) === 3) {
            ioBrokerUrl = portMatch[1];
            port = portMatch[2]; 
        }
        else {
            port = await window.showInputBox({prompt: "The port of the admin Adapter (Port where ioBroker GUI is reachable)", value: "8081", ignoreFocusOut: true});
        }
        
        if (!port) {
            return new NoConfig();
        }

        if (ioBrokerUrl.startsWith("https:")) {
            allowSelfSignedCertificate = (await window.showQuickPick(["No", "Yes"], {canPickMany: false, placeHolder: "Are you using a self signed certificate?", ignoreFocusOut: true})) === "Yes";
        }

        const scriptPath = await window.showInputBox({prompt: "The relative path in your workspace to the scripts", value: "/", ignoreFocusOut: true});
        if (!scriptPath) {
            return new NoConfig();
        }

        const shouldCreateTypeDefinitionConfig = await window.showQuickPick(["Yes", "No"], {canPickMany: false, placeHolder: "Configure ioBroker type defintions?", ignoreFocusOut: true});
        if (!shouldCreateTypeDefinitionConfig) {
            return new NoConfig();
        }
        
        if (shouldCreateTypeDefinitionConfig && shouldCreateTypeDefinitionConfig === "Yes") {
            await this.typeDefinitionService.downloadFromGithubAndSave();
            await this.typeDefinitionService.createConfig();
        }

        const uri = `${ioBrokerUrl}:${port}`;
        const parsedUri = Uri.parse(uri);

        let username: string | undefined = undefined;
        let accessToken: string | undefined = undefined;
        if (await this.loginService.isLoginNecessary(parsedUri, allowSelfSignedCertificate)) {
            username = await window.showInputBox({prompt: "Login necessary. Enter user name", value: "admin", ignoreFocusOut: true});

            if (!username) {
                return new NoConfig();
            }

            accessToken = await this.loginService.getAccessToken(parsedUri, allowSelfSignedCertificate, username);

            if(!accessToken) {
                return new NoConfig();
            }
        }

        const statusBarMessage = window.setStatusBarMessage("$(sync~spin) Trying to detect used ioBroker Admin version...");
        const adminVersion = await this.getAdminVersion(uri, allowSelfSignedCertificate, accessToken);    
        statusBarMessage.dispose();

        if (adminVersion === AdminVersion.unknown) {
            return new NoConfig();
        }
        
        return new Config(ioBrokerUrl, Number.parseInt(port), scriptPath, adminVersion, undefined, undefined, allowSelfSignedCertificate, username);
    }

    private async getAdminVersion(ioBrokerUrl: string, allowSelfSignedCertificate: boolean, accessToken?: string): Promise<AdminVersion> {
        const admin4 = "Admin 4";
        const admin5 = "Admin 5";
        const admin6 = "Admin 6";
        const admin7 = "Admin 7";

        let adminVersion = await this.adminVersionDetector.getVersion(ioBrokerUrl, allowSelfSignedCertificate, accessToken);
        
        if (adminVersion === AdminVersion.unknown) {
            const adminVersionPick = await window.showQuickPick(
                [admin4, admin5, admin6, admin7], 
                { 
                    placeHolder: "Could not determine the used Admin version. Which version are you using?",
                    ignoreFocusOut: true
                });
            
            switch(adminVersionPick) {
                case admin4:
                   return AdminVersion.admin4;
                case admin5:
                    adminVersion = AdminVersion.admin5;
                    break;
                case admin6:
                    adminVersion = AdminVersion.admin6;
                    break;
                case admin7:
                    adminVersion = AdminVersion.admin7;
                    break;
                default:
                    break;
            }
        }

        return adminVersion;
    }
}
