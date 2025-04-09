import { IScriptRepositoryService } from "./IScriptRepositoryService";
import { IScript } from "../../models/IScript";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IScriptRemoteService } from "../scriptRemote/IScriptRemoteService";
import { IDirectory } from "../../models/IDirectory";
import { IDirectoryService } from "../directory/IDirectoryService";
import { IScriptChangedEventListener } from "../scriptRemote/IScriptChangedListener";
import { RootDirectory } from "../../models/RootDirectory";
import { ILocalScript } from "../../models/ILocalScript";
import { FileCreateEvent, FileDeleteEvent, Uri, workspace } from "vscode";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IScriptService } from "../script/IScriptService";
import { EngineType } from "../../models/EngineType";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { ScriptId } from "../../models/ScriptId";
import { IScriptIdService } from "../scriptId/IScriptIdService";

@injectable()
export class ScriptRepositoryService implements IScriptRepositoryService, IScriptChangedEventListener {
    private scripts: ILocalScript[] = [];
    private directories: IDirectory[] = [];
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();

    constructor(
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
    ) { }

    async init(): Promise<void> {
        this.scriptRemoteService.init();
        await this.updateFromServer();
        this.scriptRemoteService.registerScriptChangedEventListener(this);
        this.raiseScriptChangedEvent(undefined);
        
        this.handleTextDocumentChanges();
        this.handleFileChangeOnDisk();
        this.handleDocumentCreation();
        this.handDocumentDeletion();
    }

    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        if (this.scriptEventListeners.includes(listener)) {
            return;
        }

        this.scriptEventListeners.push(listener);
    }

    async updateFromServer(): Promise<void> {
        const ioBrokerDirectories = await this.directoryService.downloadAllDirectories();
        const unsortedDirectories = ioBrokerDirectories.map(dir => {
            return {
                _id: dir._id,
                common: dir.common,
                relativeUri: this.getRelativeDirectoryUri(dir, ioBrokerDirectories),
                absoluteUri: this.getAbsoluteDirectoryUri(dir, ioBrokerDirectories)
            };
        });

        this.directories = unsortedDirectories.sort((dir1, dir2) => this.compareIds(dir1._id, dir2._id));

        const ioBrokerScripts = await this.scriptRemoteService.downloadAllScripts();
        const unsortedScripts = await Promise.all(ioBrokerScripts.map(async script => {
            return await this.createLocalScript(script);
        }));

        this.scripts = this.sortScripts(unsortedScripts);
    }

    async updateSingleScriptFromServer(id: ScriptId): Promise<void> {
        const updatedScript = await this.scriptRemoteService.downloadScriptWithId(id);
        
        // find script in the local repository
        const script = this.scripts.find(s => s._id.toLocaleLowerCase() === id.toLocaleLowerCase());
        
        if (script) {
            // Update the existing script
            script.ioBrokerScript = updatedScript;
            script.isDirty = await this.isScriptDirty(updatedScript, script.absoluteUri);
            script.isRemoteOnly = await this.isRemoteOnly(script.absoluteUri);
        } else {
            // If the script is not found in the local repository, add it
            const localScript = await this.createLocalScript(updatedScript);
            this.scripts.push(localScript);
            this.scripts = this.sortScripts(this.scripts);
        }
    }

    async evaluateDirtyStateForAllScripts(): Promise<void> {
        for (const script of this.scripts) {
            await this.evaluateDirtyState(script);
        }
    }

    async evaluateDirtyState(script: ILocalScript): Promise<void> {
        const dirtyStateBefore = script.isDirty;
        script.isDirty = await this.isScriptDirty(script.ioBrokerScript, script.absoluteUri);

        if (dirtyStateBefore !== script.isDirty) {
            this.raiseScriptChangedEvent(script._id);
        }
    }

    async evaluateScriptOnRemoteForAllScripts(): Promise<void> {
        for (const script of this.scripts) {
            await this.evaluateScriptOnRemote(script);
        }
    }

    async evaluateScriptOnRemote(script: ILocalScript): Promise<void> {
        const isRemoteOnlyBefore = script.isRemoteOnly;
        script.isRemoteOnly = await this.isRemoteOnly(script.absoluteUri);

        if (isRemoteOnlyBefore !== script.isRemoteOnly) {
            this.raiseScriptChangedEvent(script._id);
        }
    }

    getAllChangedScripts(): ILocalScript[] {
        return this.scripts.filter(s => s.isDirty && !s.isRemoteOnly);
    }

    getAllScripts(): ILocalScript[] {
        return this.scripts;
    }

    getAllDirectories(): IDirectory[] {
        return this.directories;
    }

    getScriptFromAbsolutUri(uri: Uri): ILocalScript | undefined {
        return this.scripts.find(script => script.absoluteUri.path === uri.path);
    }

    getScriptFromId(id: ScriptId): ILocalScript | undefined {
        return this.scripts.find(script => script._id === id);
    }

    async getScriptWithLocalContent(localScript: ILocalScript): Promise<IScript | null> {
        const script = localScript.ioBrokerScript;
        const scriptName = script.common.name;

        if (!scriptName) {
            throw new Error(`Cannot upload script '${script._id}', because it's name is not set`);
        }

        const scriptText = await this.scriptService.getFileContentOnDisk(localScript.absoluteUri);
        const existingScript = await this.scriptRemoteService.downloadScriptWithId(script._id);

        if (existingScript) {
            existingScript.common.source = scriptText ?? "";
            return existingScript;
        }

        return null;
    }

    getRootLevelScript(): ILocalScript[] {
        return this.getScriptsIn(this.getRootDirectory());
    }

    getRootLevelDirectories(): IDirectory[] {
        return this.getDirectoriesIn(this.getRootDirectory());
    }

    getRootDirectory(): IDirectory {
        return new RootDirectory(this.workspaceService, this.configRepositoryService);
    }

    getScriptsIn(directory: IDirectory): ILocalScript[] {
        return this.filterByLength(this.scripts, directory, 1);
    }

    getDirectoriesIn(directory: IDirectory): IDirectory[] {
        return this.filterByLength(this.directories, directory, 1);
    }

    async onScriptChanged(id: string): Promise<void> {
        // TODO: Currently all scripts are redownloaded every time a single script changes.
        //       Performance could be optimized, if only the changed script is updated.
        await this.updateSingleScriptFromServer(new ScriptId(id));
        this.raiseScriptChangedEvent(id);
    }

    onNoScriptAvailable(): void {
        this.directories = [];
        this.scripts = [];
        this.raiseScriptChangedEvent(undefined);
    }

    private sortScripts(scripts: ILocalScript[]): ILocalScript[] {
        return scripts.sort((script1, script2) => this.compareIds(script1._id, script2._id));
    }

    private async createLocalScript(script: IScript): Promise<ILocalScript> {
        const absoluteUri = this.getAbsoluteFileUri(script, this.directories);
        const relativeUri = this.getRelativeFileUri(script, this.directories);

        return {
            _id: script._id,
            ioBrokerScript: script,
            absoluteUri: absoluteUri,
            relativeUri: relativeUri,
            isDirty: await this.isScriptDirty(script, absoluteUri),
            isRemoteOnly: await this.isRemoteOnly(absoluteUri)
        };
    }

    private compareIds(id1: ScriptId, id2: ScriptId): number {
        return id1.localeCompare(<string>id2);
    }

    private getRelativeDirectoryUri(dir: IDirectory, ioBrokerDirectories: IDirectory[]): Uri {
        let currentDirectory: IDirectory = dir;
        let parentPath: string[] = [dir.common?.name ?? "unkown"];

        let scriptRoot = this.configRepositoryService.config.scriptRoot;
        scriptRoot = scriptRoot.endsWith("/") ? scriptRoot.slice(0, -1) : scriptRoot;

        do {
            currentDirectory = this.getParentDirectory(currentDirectory, ioBrokerDirectories);
            const name = currentDirectory.common?.name;
            if (name) {
                parentPath.push(name);
            }
        } while (!(currentDirectory instanceof RootDirectory));

        const directoryPath = parentPath.reverse().join("/");
        const fullDirectoryPath = `${scriptRoot}/${directoryPath}`;
        return Uri.parse(fullDirectoryPath);
    }

    private getAbsoluteDirectoryUri(dir: IDirectory, directories: IDirectory[]): Uri {
        const workspaceRoot = this.workspaceService.workspaceToUse;
        const relativeFileUri = this.getRelativeDirectoryUri(dir, directories);

        return Uri.joinPath(workspaceRoot.uri, relativeFileUri.path);
    }

    private getRelativeFileUri(script: IScript, directories: IDirectory[]): Uri {
        const engineType = <EngineType>script.common.engineType ?? EngineType.unkown;
        const extension = this.scriptService.getFileExtension(engineType);

        let parentDirectory = this.getParentDirectory(script, directories);

        const parentDirectoryUri = Uri.parse(parentDirectory.relativeUri.path);
        const relativeUri = Uri.joinPath(parentDirectoryUri, `${script.common.name}.${extension}`);
        return relativeUri;
    }

    private getAbsoluteFileUri(script: IScript, directories: IDirectory[]): Uri {
        const workspaceRoot = this.workspaceService.workspaceToUse;
        const relativeFileUri = this.getRelativeFileUri(script, directories);

        return Uri.joinPath(workspaceRoot.uri, relativeFileUri.path);
    }

    private getParentDirectory(child: IScript | IDirectory, directories: IDirectory[]): IDirectory {
        const parentId = child._id.substring(0, child._id.lastIndexOf("."));
        const parents = directories.filter(item => item._id === parentId);

        if (parents.length === 0) {
            return new RootDirectory(this.workspaceService, this.configRepositoryService);
        } else if (parents.length === 1) {
            return parents[0];
        }

        throw Error(`Could not find parent for ${child._id}`);
    }

    private filterByLength<TSource extends ILocalScript | IDirectory>(source: TSource[], child: IScript | IDirectory, offset: number): TSource[] {
        const partCountDirectory = child._id.split(".").length;
        return source.filter(item => {
            if (item._id.startsWith(<string>child._id)) {
                const partCountDir = item._id.split(".").length;
                return partCountDirectory + offset === partCountDir;
            }
            return false;
        });
    }

    private raiseScriptChangedEvent(id: string | ScriptId | undefined) {
        this.scriptEventListeners.forEach(listener => listener.onScriptChanged(<string>id));
    }

    private async isScriptDirty(script: IScript, absoluteScriptUri: Uri): Promise<boolean> {
        const serverScriptBuffer = Buffer.from(script.common.source ?? "");
        const localScriptBuffer = Buffer.from(await this.scriptService.getFileContentOnDisk(absoluteScriptUri) ?? "");

        return !serverScriptBuffer.equals(localScriptBuffer);
    }

    private async isRemoteOnly(absoluteUri: Uri) {
        return !await this.scriptService.existsScriptLocally(absoluteUri);
    }

    private handleTextDocumentChanges() {
        workspace.onDidSaveTextDocument(async document => {
            const scriptId = this.scriptIdService.getIoBrokerId(document.uri);

            var matchingScript = this.scripts.find(script => script._id === scriptId);
            if (matchingScript) {
                matchingScript.isDirty = await this.isScriptDirty(matchingScript.ioBrokerScript, document.uri);
            }

            this.raiseScriptChangedEvent(<string>scriptId);
        });
    }

    private async handleFileChangeOnDisk(): Promise<void> {    
        const config = await this.configRepositoryService.read(this.workspaceService.workspaceToUse);
        const watchPattern = config.scriptRoot === '/' ? 
        '**/*.ts' : 
        config.scriptRoot + '/**/*.{js,ts}';

        const watcher = workspace.createFileSystemWatcher(watchPattern);
        watcher.onDidChange(async uri => {
            const script = this.getScriptFromAbsolutUri(uri);

            if(script) {
                await this.evaluateDirtyState(script);
            }
        });
    }

    private handleDocumentCreation() {
        workspace.onDidCreateFiles(async createEvent => {
            this.handleFileEvent(createEvent);
        });
    }

    private handDocumentDeletion() {
        workspace.onDidDeleteFiles(async deleteEvent => {
            this.handleFileEvent(deleteEvent);
        });
    }

    private handleFileEvent(createEvent: FileDeleteEvent | FileCreateEvent) {
        for (const file of createEvent.files) {
            const matchingScript = this.scripts.find(script => script.absoluteUri.fsPath === file.fsPath);
            if (matchingScript) {
                this.evaluateScriptOnRemote(matchingScript);
                this.evaluateDirtyState(matchingScript);
            }
        }
    }
}
