import * as vscode from 'vscode';

import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptExplorerProvider } from './IScriptExplorerProvider';
import { ScriptDirectory } from './ScriptDirectory';
import { ScriptItem } from './ScriptItem';
import { IScriptChangedEventListener } from '../../services/scriptRemote/IScriptChangedListener';
import { IIobrokerConnectionService } from '../../services/iobrokerConnection/IIobrokerConnectionService';
import { NoConfig } from '../../models/Config';
import { IScriptRemoteService } from '../../services/scriptRemote/IScriptRemoteService';
import { IScript } from '../../models/IScript';
import { IScriptRepositoryService } from '../../services/scriptRepository/IScriptRepositoryService';

@injectable()
export class ScriptExplorerProvider implements vscode.TreeDataProvider<ScriptItem | ScriptDirectory>, IScriptExplorerProvider, IScriptChangedEventListener {

    private scripts: undefined | IScript[];
    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | ScriptDirectory | undefined | null | void> = new vscode.EventEmitter<ScriptItem | ScriptDirectory | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | ScriptDirectory | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.scriptRemote) private scriptRemoteService: IScriptRemoteService
    ) {
        scriptRemoteService.registerScriptChangedEventListener(this);
    }
    
    getTreeItem(element: ScriptItem | ScriptDirectory): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem | ScriptDirectory): Promise<Array<ScriptItem | ScriptDirectory>> {
        if(!element) {
            this.scripts = await this.scriptRemoteService.downloadAllScripts();
            return this.getRootLevelItems(this.scripts);
        }

        if (element && element instanceof ScriptDirectory && this.scripts) {
            return this.getChildItems(this.scripts, element.path);
        }

        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    onScriptChanged(): void {
        this.refresh();
    }
    
    private convertToScriptItems(script: IScript[]): ScriptItem[] {
        return script.map(this.convertToScriptItem);
    }

    private convertToScriptItem(script: IScript): ScriptItem {
        return new ScriptItem(script);
    }

    private convertToScriptDirectories(scriptOjbects: IScript[], prefix: string, collapse: boolean): ScriptDirectory[] {
        return scriptOjbects.map((scriptObject) => this.convertToScriptDirectory(scriptObject, prefix, collapse));
    }

    private convertToScriptDirectory(script: IScript, prefix: string, collapse: boolean): ScriptDirectory {
        const prefixParts = prefix.split(".").length;
        const name = script._id.split(".")[prefixParts - 1];
        const directoryPath = `${prefix}${name}.`;

        return new ScriptDirectory(name, directoryPath, collapse);
    }

    private async getRootLevelItems(scripts: IScript[]): Promise<Array<ScriptItem | ScriptDirectory>> {
        return await this.getChildItems(scripts, "script.js.");
    }

    private async getChildItems(scripts: IScript[], prefix: string): Promise<Array<ScriptItem | ScriptDirectory>> {
        const prefixDirectoryCount = prefix.split(".").length;
        const currentLevelDirectories = scripts.filter(script => script._id.startsWith(prefix) && prefixDirectoryCount < script._id.split(".").length);
        const currentLevelScripts = scripts.filter(script => script._id.startsWith(prefix) && prefixDirectoryCount === script._id.split(".").length);
        const collapseDirectories = this.shouldDirectoriesBeCollapsed();

        const scriptDirectories = await this.convertToScriptDirectories(currentLevelDirectories, prefix, collapseDirectories);
        const scriptItems = this.convertToScriptItems(currentLevelScripts);

        let items: Array<ScriptItem | ScriptDirectory> = new Array();
        items = items.concat(scriptDirectories.filter(this.onlyUnique));
        items = items.concat(scriptItems);        

        return items;
    }

    private onlyUnique(directory: ScriptDirectory, index: number, directories: ScriptDirectory[]): boolean {
        const firstMatchingDirectory = directories.filter(dir => dir.path === directory.path)[0];
        return directories.indexOf(firstMatchingDirectory) === index;
    }

    private shouldDirectoriesBeCollapsed(): boolean {
        const config = this.iobrokerConnectionService.config;
        if (!(config instanceof NoConfig)) {
            return config.scriptExplorer?.collapseDirectoriesOnStartup ?? true;
        }

        return true;
    }
}
