import { ICommand } from "./ICommand";
import { injectable } from "inversify";

@injectable()
export class ReorderCommand implements ICommand {
    id: string = "iobroker-javascript.download";

    constructor(
    ) {}
    
    async execute(...args: any[]) {
        console.log(args);
    }
}
