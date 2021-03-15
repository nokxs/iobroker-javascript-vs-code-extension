import { IDirectory } from "../../models/IDirectory";
import { ScriptId } from "../../models/ScriptId";

export interface IDirectoryService {
    downloadDirectory(id: ScriptId): Promise<IDirectory>
    downloadAllDirectories(): Promise<IDirectory[]>
    createDirectory(id: ScriptId, name: string): Promise<void>
    createDirectoriesRecursively(scriptId: ScriptId): Promise<void>
}
