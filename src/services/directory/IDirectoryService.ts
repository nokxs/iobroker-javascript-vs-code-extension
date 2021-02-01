import { IDirectory } from "../../models/IDirectory";

export interface IDirectoryService {
    downloadAllDirectories(): Promise<IDirectory[]>
}
