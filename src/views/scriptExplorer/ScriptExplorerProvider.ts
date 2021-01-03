import * as vscode from 'vscode';

import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IConnectionService } from '../../services/connection/IConnectionService';
import { Script, ScriptObject } from '../../models/Script';

export interface IScriptExplorerProvider {
    
}

export class ScriptDirectory extends vscode.TreeItem {
    constructor(public name: string, public path: string) {
        super(name, vscode.TreeItemCollapsibleState.Expanded);
    }
}

export class ScriptItem extends vscode.TreeItem {
    constructor(public script: Script) {
        super(script.common?.name ?? "INVALID NAME", vscode.TreeItemCollapsibleState.None);
    }
}

@injectable()
export class ScriptExplorerProvider implements vscode.TreeDataProvider<ScriptItem | ScriptDirectory>, IScriptExplorerProvider {

    private scripts: undefined | ScriptObject[];

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
    ) {}

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | ScriptDirectory | null | undefined> | undefined;
    
    getTreeItem(element: ScriptItem | ScriptDirectory): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem | ScriptDirectory): Promise<Array<ScriptItem | ScriptDirectory>> {
        if(!element && !this.scripts) {
            this.scripts = await this.connectionService.downloadAllScripts();
            return this.getRootLevelItems(this.scripts);
        }
       
        if (element && element instanceof ScriptDirectory && this.scripts) {
            return this.getChildItems(this.scripts, element.path);
        }

        return Promise.resolve([]);
    }

    private convertToScriptItems(scriptOjbects: ScriptObject[]): ScriptItem[] {
        return scriptOjbects.map(this.convertToScriptItem);
    }

    private convertToScriptItem(scriptObject: ScriptObject): ScriptItem {
        return new ScriptItem(scriptObject.value);
    }

    private convertToScriptDirectories(scriptOjbects: ScriptObject[], prefix: string): ScriptDirectory[] {
        return scriptOjbects.map(scriptObject => this.convertToScriptDirectory(scriptObject, prefix));
    }

    private convertToScriptDirectory(scriptObject: ScriptObject, prefix: string): ScriptDirectory {
        const prefixParts = prefix.split(".").length;
        const name = scriptObject.value._id.split(".")[prefixParts - 1];
        const directoryPath = `${prefix}${name}.`;

        return new ScriptDirectory(name, directoryPath);
    }

    private getRootLevelItems(scripts: ScriptObject[]): Array<ScriptItem | ScriptDirectory> {
        return this.getChildItems(scripts, "script.js.");
    }

    private getChildItems(scripts: ScriptObject[], prefix: string): Array<ScriptItem | ScriptDirectory> {
        const prefixDirectoryCount = prefix.split(".").length;
        const currentLevelDirectories = scripts.filter(script => script.value._id.startsWith(prefix) && prefixDirectoryCount < script.value._id.split(".").length);
        const currentLevelScripts = scripts.filter(script => script.value._id.startsWith(prefix) && prefixDirectoryCount === script.value._id.split(".").length);

        const scriptDirectories = this.convertToScriptDirectories(currentLevelDirectories, prefix);
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
}
