import { DirectoryReference, IDirectory } from "../../models/IDirectory";
import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { IDirectoryService } from "../directory/IDirectoryService";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";

/** The remote counterpart of a directory: no local URI, only the ioBroker object. */
export type RemoteDirectory = DirectoryReference;

export interface RemoteScriptRepositoryDeps {
    scriptRemote: Pick<IScriptRemoteService,
        "downloadAllScripts" |
        "downloadScriptWithId" |
        "registerScriptChangedEventListener">
    directories: Pick<IDirectoryService, "downloadDirectory" | "downloadAllDirectories">
}

/**
 * The remote subset of the script repository: a cache of the ioBroker objects, invalidated by the
 * same socket events the extension uses. Deliberately not an `IScriptRepositoryService`: that
 * interface returns `ILocalScript[]` with local URIs and dirty state, which do not exist here.
 */
export class RemoteScriptRepository implements IScriptChangedEventListener {
    private scripts: IScript[] = [];
    private directories: RemoteDirectory[] = [];
    private loaded = false;
    private readonly root: RemoteDirectory = { _id: ScriptId.rootId, common: {} };

    constructor(private readonly deps: RemoteScriptRepositoryDeps) { }

    /** Subscribes to the script changes of the socket. Safe to call before the first connect. */
    init(): void {
        this.deps.scriptRemote.registerScriptChangedEventListener(this);
    }

    /** Loads the cache once, so a tool that needs to know an id does not block on every call. */
    async ensureLoaded(): Promise<void> {
        if (!this.loaded) {
            await this.updateFromServer();
        }
    }

    async updateFromServer(): Promise<void> {
        const [directories, scripts] = await Promise.all([
            this.deps.directories.downloadAllDirectories(),
            this.deps.scriptRemote.downloadAllScripts()
        ]);

        this.directories = directories
            .filter(directory => `${directory._id}` !== ScriptId.rootId)
            .map(directory => ({ _id: directory._id, common: directory.common }));
        this.scripts = scripts;
        this.loaded = true;
    }

    getAllScripts(): IScript[] {
        return this.scripts;
    }

    getAllDirectories(): RemoteDirectory[] {
        return this.directories;
    }

    getRootDirectory(): RemoteDirectory {
        return this.root;
    }

    getScriptFromId(id: ScriptId): IScript | undefined {
        const key = `${id}`.toLowerCase();
        return this.scripts.find(script => `${script._id}`.toLowerCase() === key);
    }

    /** Re-reads a single script or directory after a write operation. */
    async updateSingleScriptOrDirectoryFromServer(id: ScriptId): Promise<void> {
        const key = `${id}`.toLowerCase();

        // `getObject` answers for scripts and channels alike; only the object type tells them apart.
        const object = await this.deps.scriptRemote.downloadScriptWithId(id) as IScript | null;
        if (object && isScriptObject(object)) {
            this.scripts = this.scripts.filter(candidate => `${candidate._id}`.toLowerCase() !== key);
            this.scripts.push({ ...object, _id: new ScriptId(`${id}`) });
            return;
        }

        if (object) {
            this.directories = this.directories.filter(candidate => `${candidate._id}`.toLowerCase() !== key);
            if (`${id}` !== ScriptId.rootId) {
                this.directories.push({ _id: new ScriptId(`${id}`), common: object.common });
            }
            return;
        }

        const directory = await this.deps.directories.downloadDirectory(id) as IDirectory | null;
        if (directory) {
            this.directories = this.directories.filter(candidate => `${candidate._id}`.toLowerCase() !== key);
            if (`${id}` !== ScriptId.rootId) {
                this.directories.push({ _id: new ScriptId(`${id}`), common: directory.common });
            }
            return;
        }

        this.scripts = this.scripts.filter(candidate => `${candidate._id}`.toLowerCase() !== key);
        this.directories = this.directories.filter(candidate => `${candidate._id}`.toLowerCase() !== key);
    }

    onScriptChanged(id: string | undefined): void {
        if (!id || !ScriptId.isDirectoryId(id)) {
            return;
        }

        this.updateSingleScriptOrDirectoryFromServer(new ScriptId(id)).catch(() => {
            // A failed refresh is harmless: the next explicit refresh corrects the cache.
        });
    }

    onNoScriptAvailable(): void {
        this.scripts = [];
        this.directories = [];
        this.loaded = false;
    }

    /** Used by tests and by the runner to know whether a first load is still needed. */
    isLoaded(): boolean {
        return this.loaded;
    }
}

/** `getObject` also answers with channels (directories), which have a different `type`. */
function isScriptObject(value: IScript): boolean {
    const type = (value as unknown as { type?: string }).type;
    return type === undefined || type === "script";
}
