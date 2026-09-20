import * as path from 'path';
import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptExplorerProvider, ScriptExplorerItem } from './IScriptExplorerProvider';
import { ScriptDirectory } from './ScriptDirectory';
import { ScriptItem } from './ScriptItem';
import { IScriptChangedEventListener } from '../../services/scriptRemote/IScriptChangedListener';
import { IIobrokerConnectionService } from '../../services/iobrokerConnection/IIobrokerConnectionService';
import { NoConfig } from '../../models/Config';
import { IScriptRepositoryService } from '../../services/scriptRepository/IScriptRepositoryService';
import { IDirectory } from '../../models/IDirectory';
import { RootDirectory } from '../../models/RootDirectory';
import { ILocalScript } from '../../models/ILocalScript';
import { IWorkspaceService } from '../../services/workspace/IWorkspaceService';
import { OnlyLocalScriptItem } from './OnlyLocalScriptItem';
import { ILocalOnlyScriptRepositoryService } from '../../services/localOnlyScriptRepository/ILocalOnlyScriptRepositoryService';
import { OnlyLocalDirectoryItem } from './OnlyLocalDirectoryItem';
import { ILocalOnlyScript } from '../../models/ILocalOnlyScript';
import { IConfigRepositoryService } from '../../services/configRepository/IConfigRepositoryService';
import { OnlyRemoteScriptItem } from './OnlyRemoteScriptItem';

const ROOT_DIRECTORY_ID = "script.js";
const AUTO_SYNC_CONTEXT_KEY = "iobrokerAutoSyncEnabled";

@injectable()
export class ScriptExplorerProvider implements IScriptExplorerProvider, IScriptChangedEventListener {

    private parentOf = new Map<string, ScriptExplorerItem>();

    private currentScriptUri: vscode.Uri | undefined;

    private isRevealing = false;

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptExplorerItem | undefined | null | void> = new vscode.EventEmitter<ScriptExplorerItem | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptExplorerItem | null | undefined> | undefined = this._onDidChangeTreeData.event;
    treeView!: vscode.TreeView<ScriptExplorerItem>;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.localOnlyScriptRepository) private localOnlyScriptRepositoryService: ILocalOnlyScriptRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {
        scriptRepositoryService.registerScriptChangedEventListener(this);
        
        vscode.workspace.onDidCreateFiles(() => this.refresh());
        vscode.workspace.onDidDeleteFiles(() => this.refresh());
    }

    get autoRevealEnabled(): boolean {
        const config = this.configRepositoryService.config;
        if (config instanceof NoConfig) {
            return true;
        }

        return config.scriptExplorer?.revealCurrentScript ?? true;
    }

    getParent(element: ScriptExplorerItem): ScriptExplorerItem | undefined {
        return this.parentOf.get(this.toKey(element.id));
    }

    /**
     * The ids of the tree items are either real strings or `ScriptId` objects (which are String wrappers).
     * Both have to be mapped to a real string, because the map treats objects and primitives as different keys.
     */
    private toKey(id: string | undefined): string {
        return id ? `${id}` : "";
    }

    async setAutoRevealEnabled(enabled: boolean): Promise<void> {
        const config = this.configRepositoryService.config;
        if (config instanceof NoConfig) {
            vscode.window.showWarningMessage("ioBroker: Cannot save the auto sync setting, because no valid ioBroker configuration was found.");
            return;
        }

        const updatedConfig = { ...config, scriptExplorer: { ...config.scriptExplorer, revealCurrentScript: enabled } };
        await this.configRepositoryService.write(updatedConfig, this.workspaceService.workspaceToUse);
        this.updateAutoSyncContext();
    }

    updateAutoSyncContext(): void {
        void vscode.commands.executeCommand("setContext", AUTO_SYNC_CONTEXT_KEY, this.autoRevealEnabled);
    }
    
    getTreeItem(element: ScriptItem | ScriptDirectory): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    onActiveEditorChanged(uri: vscode.Uri | undefined): void {
        this.currentScriptUri = uri;

        // Only reveal while the script explorer is already visible. Revealing would otherwise
        // bring the view to the front and take the user away from the file explorer.
        if (this.isVisible()) {
            void this.revealCurrentScript();
        }
    }

    /**
     * Reveals the script of the currently active editor in the script explorer. Does nothing if
     * the script explorer is not visible or no script belongs to the active editor.
     */
    async revealCurrentScript(): Promise<void> {
        // The tracked uri is used, because the active text editor is not available anymore as soon as
        // the focus is on the tree view. If nothing was tracked so far (e.g. the editor was restored
        // after the extension was activated), the current editor is used as fallback.
        const uri = this.currentScriptUri ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri || !this.autoRevealEnabled || !this.isVisible() || this.isRevealing) {
            return;
        }

        // Before the connection is established the script list is not available yet. The current
        // script is revealed as soon as the scripts are loaded.
        if (!this.iobrokerConnectionService.isConnected()) {
            return;
        }

        const item = this.resolveItem(uri);
        if (!item) {
            return;
        }

        this.fillParentChain(item);

        this.isRevealing = true;
        try {
            await this.treeView.reveal(item, { select: true, focus: false, expand: true });
        } catch {
            // Revealing can fail while the tree view is still loading. The next change of the active
            // editor or a new visibility change will try it again.
        } finally {
            this.isRevealing = false;
        }
    }

    private isVisible(): boolean {
        return this.treeView?.visible ?? false;
    }

    async getChildren(element?: ScriptExplorerItem): Promise<Array<ScriptExplorerItem>> {
        if (!this.iobrokerConnectionService.isConnected()) {
            return Promise.resolve([]);
        }
        
        if(!element) {
            return this.getRootLevelItems();
        }

        if (element && element instanceof ScriptDirectory) {
            return this.getChildItems(element.directory, element);
        }

        if (element && element instanceof OnlyLocalDirectoryItem) {
            return await this.getLocalOnlyChildItems(element.directory, element);
        }

        return Promise.resolve([]);
    }

    refresh(): void {
        this.parentOf.clear();
        this._onDidChangeTreeData.fire();
    }
    
    onScriptChanged(): void {
        this.refresh();
        void this.revealCurrentScript();
    }

    onNoScriptAvailable(): void {
        this.refresh();
    }

    private async getRootLevelItems(): Promise<Array<ScriptExplorerItem>> {
        return await this.getChildItems(new RootDirectory(this.workspaceService, this.configRepositoryService), undefined);
    }

    private async getChildItems(directory: IDirectory, parent: ScriptExplorerItem | undefined): Promise<Array<ScriptExplorerItem>> {

        const directories = await this.scriptRepositoryService.getDirectoriesIn(directory);
        const directoriesOnlyLocal = await this.localOnlyScriptRepositoryService.getLocalOnlyDirectoriesIn(directory);

        const scripts = await this.scriptRepositoryService.getScriptsIn(directory);
        const scriptsOnlyLocal = await this.localOnlyScriptRepositoryService.getOnlyLocalScriptsIn(directory);
        
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();
        const scriptDirectories = this.convertToScriptDirectories(directories, collapseDirectories);
        const scriptItems = this.convertToScriptItems(scripts.filter(s => !s.isRemoteOnly));
        const onlyLocalScriptItems = this.convertToOnlyLocalScriptItems(scriptsOnlyLocal);
        const onlyRemoteScritpItems = this.convertToOnlyRemoteScriptItems(scripts.filter(s => s.isRemoteOnly));
        const onlyLocalDirectoryItems = this.convertToOnlyLocalDirectories(directoriesOnlyLocal, collapseDirectories);

        let items: Array<ScriptExplorerItem> = new Array();
        items = items.concat(scriptDirectories);
        items = items.concat(onlyLocalDirectoryItems);
        items = items.concat(scriptItems);     
        items = items.concat(onlyLocalScriptItems); 
        items = items.concat(onlyRemoteScritpItems); 

        this.registerParent(items, parent);

        return items;
    }

    private async getLocalOnlyChildItems(directory: ILocalOnlyScript, parent: OnlyLocalDirectoryItem): Promise<Array<OnlyLocalScriptItem | OnlyLocalDirectoryItem>> {
        const direcoriesOnlyLocal = await this.localOnlyScriptRepositoryService.getSupportedLocalDirectories(directory.path);
        const scriptsOnlyLocal = await this.localOnlyScriptRepositoryService.getSupportedLocalOnlyFiles(directory.path);
        
        const onlyLocalScriptItems = this.convertToOnlyLocalScriptItems(scriptsOnlyLocal);
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();
        const onlyLocalDirectoryItems = direcoriesOnlyLocal.map(localDirectory => new OnlyLocalDirectoryItem(localDirectory, collapseDirectories));
        
        let items: Array<OnlyLocalScriptItem | OnlyLocalDirectoryItem> = new Array();
        items = items.concat(onlyLocalDirectoryItems);
        items = items.concat(onlyLocalScriptItems);   

        this.registerParent(items, parent);

        return items;
    }

    /**
     * Memorizes the parent of all given items. This is required by the tree view to reveal
     * items which are below a directory that is not expanded yet.
     */
    private registerParent(items: ScriptExplorerItem[], parent: ScriptExplorerItem | undefined): void {
        if (!parent) {
            return;
        }

        for (const item of items) {
            this.parentOf.set(this.toKey(item.id), parent);
        }
    }

    private shouldDirectoriesBeCollapsed(): boolean {
        const config = this.iobrokerConnectionService.config;
        if (!(config instanceof NoConfig)) {
            return config.scriptExplorer?.collapseDirectoriesOnStartup ?? true;
        }

        return true;
    }
    
    private convertToScriptItems(scripts: ILocalScript[]): ScriptItem[] {
        return scripts.map(s => new ScriptItem(s));
    }

    private convertToScriptDirectories(directories: IDirectory[], collapse: boolean): ScriptDirectory[] {
        return directories.map(d => new ScriptDirectory(d, collapse));
    }
    
    private convertToOnlyLocalScriptItems(onlyLocalScripts: ILocalOnlyScript[]): OnlyLocalScriptItem[] {
        return onlyLocalScripts.map(localScript => new OnlyLocalScriptItem(localScript.path));
    }
    
    private convertToOnlyRemoteScriptItems(scripts: ILocalScript[]): OnlyRemoteScriptItem[] {
        return scripts.map(s => new OnlyRemoteScriptItem(s));
    }

    private convertToOnlyLocalDirectories(onlyLocalDirectories: ILocalOnlyScript[], collapse: boolean): OnlyLocalDirectoryItem[] {
        return onlyLocalDirectories.map(localDirectory => new OnlyLocalDirectoryItem(localDirectory, collapse));
    }

    private resolveItem(uri: vscode.Uri): ScriptExplorerItem | undefined {
        const script = this.scriptRepositoryService.getScriptFromAbsolutUri(uri);
        if (script) {
            return script.isRemoteOnly ? new OnlyRemoteScriptItem(script) : new ScriptItem(script);
        }

        if (uri.scheme === "file" && this.isSupportedScriptFile(uri) && this.isInScriptRoot(uri.fsPath)) {
            return new OnlyLocalScriptItem(uri);
        }

        return undefined;
    }

    /**
     * Adds all items of the given item up to the root of the tree to the parent cache, so that
     * the tree view is able to expand the collapsed ancestors when revealing the item.
     */
    private fillParentChain(item: ScriptExplorerItem): void {
        if (item instanceof ScriptItem) {
            this.fillRemoteParents(<string>item.script._id);
            return;
        }

        if (item instanceof OnlyLocalScriptItem) {
            this.fillLocalParents(item.fileUri.fsPath);
        }
    }

    private fillRemoteParents(childId: string): void {
        const directories = this.getDirectoriesById();
        const collapse = this.shouldDirectoriesBeCollapsed();

        let currentChildId: string | undefined = childId;
        while (currentChildId) {
            const parentId = currentChildId.substring(0, currentChildId.lastIndexOf("."));
            if (!parentId || parentId === ROOT_DIRECTORY_ID) {
                return;
            }

            const parentDirectory = directories.get(parentId);
            if (!parentDirectory) {
                return;
            }

            this.parentOf.set(this.toKey(currentChildId), new ScriptDirectory(parentDirectory, collapse));
            currentChildId = parentId;
        }
    }

    private fillLocalParents(filePath: string): void {
        const directoriesByPath = this.getDirectoriesByPath();
        const scriptRootPath = this.getScriptRootPath();
        const collapse = this.shouldDirectoriesBeCollapsed();

        let childId = filePath;
        let childPath: string | undefined = filePath;

        while (childPath) {
            const parentPath = path.dirname(childPath);
            if (parentPath === childPath || parentPath === scriptRootPath) {
                // Root level is reached, so the item has no parent in the tree.
                return;
            }

            const parentDirectory = directoriesByPath.get(parentPath);
            if (parentDirectory) {
                this.parentOf.set(this.toKey(childId), new ScriptDirectory(parentDirectory, collapse));
                this.fillRemoteParents(<string>parentDirectory._id);
                return;
            }

            if (!this.isInScriptRoot(parentPath)) {
                return;
            }

            this.parentOf.set(this.toKey(childId), new OnlyLocalDirectoryItem({ path: vscode.Uri.file(parentPath) }, collapse));
            childId = parentPath;
            childPath = parentPath;
        }
    }

    private getDirectoriesById(): Map<string, IDirectory> {
        return new Map(this.scriptRepositoryService.getAllDirectories().map(directory => [<string>directory._id, directory]));
    }

    private getDirectoriesByPath(): Map<string, IDirectory> {
        return new Map(this.scriptRepositoryService.getAllDirectories().map(directory => [directory.absoluteUri.fsPath, directory]));
    }

    private isSupportedScriptFile(uri: vscode.Uri): boolean {
        switch (path.extname(uri.fsPath)) {
            case ".js":
            case ".ts":
            case ".rules":
            case ".block":
                return true;
            default:
                return false;
        }
    }

    private isInScriptRoot(fsPath: string): boolean {
        const relativePath = path.relative(this.getScriptRootPath(), fsPath);
        return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    }

    private getScriptRootPath(): string {
        const scriptRoot = this.configRepositoryService.config.scriptRoot;
        return vscode.Uri.joinPath(this.workspaceService.workspaceToUse.uri, scriptRoot).fsPath;
    }
}
