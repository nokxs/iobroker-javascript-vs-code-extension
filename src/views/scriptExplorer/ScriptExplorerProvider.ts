import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptExplorerProvider } from './IScriptExplorerProvider';
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

@injectable()
export class ScriptExplorerProvider implements vscode.TreeDataProvider<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem>, IScriptExplorerProvider, IScriptChangedEventListener {

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem | undefined | null | void> = new vscode.EventEmitter<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.localOnlyScriptRepository) private localOnlyScriptRepositoryService: ILocalOnlyScriptRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {
        scriptRepositoryService.registerScriptChangedEventListener(this);
        
        vscode.workspace.onDidCreateFiles(() => this.refresh());
        vscode.workspace.onDidDeleteFiles(() => this.refresh());
    }
    
    getTreeItem(element: ScriptItem | ScriptDirectory): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem>> {
        if(!element) {
            return this.getRootLevelItems();
        }

        if (element && element instanceof ScriptDirectory) {
            return this.getChildItems(element.directory);
        }

        if (element && element instanceof OnlyLocalDirectoryItem) {
            return await this.getLocalOnlyChildItems(element.directory);
        }

        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    onScriptChanged(): void {
        this.refresh();
    }

    private async getRootLevelItems(): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem>> {
        return await this.getChildItems(new RootDirectory(this.workspaceService));
    }

    private async getChildItems(directory: IDirectory): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem>> {

        const directories = await this.scriptRepositoryService.getDirectoriesIn(directory);
        const directoriesOnlyLocal = await this.localOnlyScriptRepositoryService.getLocalOnlyDirectoriesIn(directory);

        const scripts = await this.scriptRepositoryService.getScriptsIn(directory);
        const scriptsOnlyLocal = await this.localOnlyScriptRepositoryService.getOnlyLocalScriptsIn(directory);
        
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();
        const scriptDirectories = this.convertToScriptDirectories(directories, collapseDirectories);
        const scriptItems = this.convertToScriptItems(scripts);
        const onlyLocalScriptItems = this.convertToOnlyLocalScriptItems(scriptsOnlyLocal);
        const onlyLocalDirectoryItems = this.convertToOnlyLocalDirectories(directoriesOnlyLocal, collapseDirectories);

        let items: Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem> = new Array();
        items = items.concat(scriptDirectories);
        items = items.concat(onlyLocalDirectoryItems);
        items = items.concat(scriptItems);     
        items = items.concat(onlyLocalScriptItems);   

        return items;
    }

    private async getLocalOnlyChildItems(directory: ILocalOnlyScript): Promise<Array<OnlyLocalScriptItem | OnlyLocalDirectoryItem>> {
        const direcoriesOnlyLocal = await this.localOnlyScriptRepositoryService.getSupportedLocalDirectories(directory.path);
        const scriptsOnlyLocal = await this.localOnlyScriptRepositoryService.getSupportedLocalOnlyFiles(directory.path);
        
        const onlyLocalScriptItems = this.convertToOnlyLocalScriptItems(scriptsOnlyLocal);
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();
        const onlyLocalDirectoryItems = direcoriesOnlyLocal.map(localDirectory => new OnlyLocalDirectoryItem(localDirectory, collapseDirectories));
        
        let items: Array<OnlyLocalScriptItem | OnlyLocalDirectoryItem> = new Array();
        items = items.concat(onlyLocalDirectoryItems);
        items = items.concat(onlyLocalScriptItems);   

        return items;
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

    private convertToOnlyLocalDirectories(onlyLocalDirectories: ILocalOnlyScript[], collapse: boolean): OnlyLocalDirectoryItem[] {
        return onlyLocalDirectories.map(localDirectory => new OnlyLocalDirectoryItem(localDirectory, collapse));
    }
}
