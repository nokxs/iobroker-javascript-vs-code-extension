import { AdminVersion } from "../../models/Config";

export interface IAdminVersionDetector {
    getVersion(iobrokerUrl: string): Promise<AdminVersion>;
}
