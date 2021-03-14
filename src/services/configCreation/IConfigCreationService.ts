import { Config } from "../../models/Config";

export interface IConfigCreationService {
    createConfigInteractivly(): Promise<Config>
}
