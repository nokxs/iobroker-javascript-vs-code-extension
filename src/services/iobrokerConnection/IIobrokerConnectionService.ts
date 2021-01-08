import { Config } from "../../models/Config";

export interface IIobrokerConnectionService {
  config: Config
  connect(): Promise<void>
}
