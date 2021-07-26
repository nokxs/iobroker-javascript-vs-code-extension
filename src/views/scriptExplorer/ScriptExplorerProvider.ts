import * as vscode from 'vscode';
import * as path from 'path';

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

@injectable()
export class ScriptExplorerProvider implements vscode.TreeDataProvider<ScriptItem | OnlyLocalScriptItem | ScriptDirectory>, IScriptExplorerProvider, IScriptChangedEventListener {

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | undefined | null | void> = new vscode.EventEmitter<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | OnlyLocalScriptItem | ScriptDirectory | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.localOnlyScriptRepository) private localOnlyScriptRepositoryService: ILocalOnlyScriptRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {
        scriptRepositoryService.registerScriptChangedEventListener(this);
    }
    
    getTreeItem(element: ScriptItem | ScriptDirectory): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem | ScriptDirectory): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory>> {
        if(!element) {
            return this.getRootLevelItems();
        }

        if (element && element instanceof ScriptDirectory) {
            return this.getChildItems(element.directory);
        }

        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    onScriptChanged(): void {
        this.refresh();
    }

    private async getRootLevelItems(): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory>> {
        return await this.getChildItems(new RootDirectory(this.workspaceService));
    }

    private async getChildItems(directory: IDirectory): Promise<Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory>> {

        const directories = await this.scriptRepositoryService.getDirectoriesIn(directory);
        const scripts = await this.scriptRepositoryService.getScriptsIn(directory);
        const scriptsOnlyLocal = this.localOnlyScriptRepositoryService.getOnlyLocalScriptsInDirectory(directory);
        
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();
        const scriptDirectories = this.convertToScriptDirectories(directories, collapseDirectories);
        const scriptItems = this.convertToScriptItems(scripts);
        const onlyLocalScriptItems = scriptsOnlyLocal.map(localScript => new OnlyLocalScriptItem(localScript));

        let items: Array<ScriptItem | OnlyLocalScriptItem | ScriptDirectory> = new Array();
        items = items.concat(scriptDirectories);
        items = items.concat(scriptItems);     
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
}
