import { Config } from "../../models/config";

export interface IConfigService {
    read(): Config
    write(config: Config): void
}
