import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ITypeDefinitionService } from "../services/typeDefinition/ITypeDefinitionService";
import { IIobrokerConnectionService } from "../services/iobrokerConnection/IIobrokerConnectionService";

@injectable()
export class UpdateTypeDefinitionCommand implements ICommand {
    id: string = "iobroker-javascript.updateTypeDefinition";
    
    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.typeDefinition) private typeDefinitionService: ITypeDefinitionService
    ) {}

    async execute() {
        if (!this.iobrokerConnectionService.isConnected()) {
            await this.iobrokerConnectionService.connect();
        }
        await this.typeDefinitionService.downloadIobrokerTypeDefinitionsFromGithubAndSave();
        await this.typeDefinitionService.downloadNodeTypeDefinitionsFromNpmAndSave();
        await this.typeDefinitionService.createConfig();
        await this.typeDefinitionService.createGlobalTypeDefinitions();
    }
}
