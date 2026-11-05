import { ICommand } from "./ICommand";
import { inject, injectable } from "inversify";
import TYPES from "../Types";
import { IAiToolService } from "../services/aiTool/IAiToolService";

@injectable()
export class ToggleAiToolsCommand implements ICommand {
    id: string = "iobroker-javascript.toggleAiTools";

    constructor(
        @inject(TYPES.services.aiToolService) private aiToolService: IAiToolService
    ) {}

    async execute() {
        await this.aiToolService.toggle();
    }
}
