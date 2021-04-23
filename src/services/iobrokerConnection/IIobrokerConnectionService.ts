import { Config } from "../../models/Config";

export interface IIobrokerConnectionService {
  config: Config
  isConnected(): boolean
  connect(): Promise<void>
}
