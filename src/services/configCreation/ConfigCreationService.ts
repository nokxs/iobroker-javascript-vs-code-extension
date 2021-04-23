import { AdminVersion, Config, NoConfig } from "../../models/Config";
import { window } from "vscode";

import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { ITypeDefinitionService } from '../typeDefinition/ITypeDefinitionService';
import { IConfigCreationService } from "./IConfigCreationService";
import { IAdminVersionDetector } from "../adminVersionDetector/IAdminVersionDetector";

@injectable()
export class ConfigCreationService implements IConfigCreationService {
    
    constructor(
        @inject(TYPES.services.typeDefinition) private typeDefinitionService: ITypeDefinitionService,
        @inject(TYPES.services.adminVersionDetector) private adminVersionDetector: IAdminVersionDetector
    ) {}

    async createConfigInteractivly(): Promise<Config> {
        const ioBrokerUrl = await window.showInputBox({prompt: "The URL to your ioBroker installation", value: "http://localhost", ignoreFocusOut: true});
        if (!ioBrokerUrl) {
            return new NoConfig();
        }
        else if (!(ioBrokerUrl.startsWith("http://") || ioBrokerUrl.startsWith("https://"))) {
            await window.showWarningMessage("The ioBroker URL has to start with 'http://' or 'https://'");
            return new NoConfig();
        }

        const port = await window.showInputBox({prompt: "The port of the socket.io Adapter", value: "8081", ignoreFocusOut: true});
        if (!port) {
            return new NoConfig();
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

        const statusBarMessage = window.setStatusBarMessage("$(sync~spin) Trying to detect used ioBroker Admin version...");
        const adminVersion = await this.getAdminVersion(`${ioBrokerUrl}:${port}`);    
        statusBarMessage.dispose();

        if (adminVersion === AdminVersion.unknown) {
            return new NoConfig();
        }
        
        return new Config(ioBrokerUrl, Number.parseInt(port), scriptPath, adminVersion);
    }

    private async getAdminVersion(ioBrokerUrl: string): Promise<AdminVersion> {
        const admin4 = "Admin 4";
        const admin5 = "Admin 5";

        let adminVersion = await this.adminVersionDetector.getVersion(ioBrokerUrl);
        
        if (adminVersion === AdminVersion.unknown) {
            const adminVersionPick = await window.showQuickPick(
                [admin4, admin5], 
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
                default:
                    break;
            }
        }

        return adminVersion;
    }
}
