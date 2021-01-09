import { Config } from "../../models/Config";

export interface IConfigService {
    createConfigInteractivly(): Promise<Config>
}
