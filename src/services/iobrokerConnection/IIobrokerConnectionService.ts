import { Config } from "../../models/Config";

export interface IIobrokerConnectionService {
  config: Config
  isConnected(): boolean
  /** Joins a running connect. While connected and initialized, only the script list is reloaded. */
  connect(): Promise<void>
  rebuildObjectIndex(): Promise<void>
}
