import { Config } from "../../models/config";

export interface IConfigService {
    read(): Config | unknown
    write(config: Config): void
}
