import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { ITypeDefinitionService } from "../services/typeDefinition/ITypeDefinitionService";

@injectable()
export class UpdateTypeDefinitionCommand implements ICommand {
    id: string = "iobroker-javascript.updateTypeDefinition";
    
    constructor(
        @inject(TYPES.services.typeDefinition) private typeDefinitionService: ITypeDefinitionService
    ) {}

    execute(...args: any[]) {
        this.typeDefinitionService.downloadFromGithubAndSave();
    }
}
