import { Config } from "../../models/config";
import { IConfigService } from "./IConfigService";
import { injectable } from "inversify";

@injectable()
export class ConfigService implements IConfigService {
    read(): Config {
        throw new Error("Method not implemented.");
    }
    write(config: Config): void {
        throw new Error("Method not implemented.");
    }
    
}