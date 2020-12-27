import { Config } from "../../models/config";

export interface IConfigService {
    read(): Promise<Config | unknown>
    write(config: Config): Promise<void>
    createConfigInteractivly(): Promise<Config>
}
