import { AdminVersion } from "../../models/Config";

export interface IAdminVersionDetector {
    getVersion(iobrokerUrl: string, allowSelfSignedCertificate: boolean, accessToken?: string): Promise<AdminVersion>;
}
