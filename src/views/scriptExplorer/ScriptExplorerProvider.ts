import * as vscode from 'vscode';

import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IConnectionService } from '../../services/connection/IConnectionService';
import { Script, ScriptObject } from '../../models/Script';

export interface IScriptExplorerProvider {
    
}

export class ScriptItem extends vscode.TreeItem {
    constructor(public script: Script) {
        super(script.common?.name ?? "INVALID NAME", vscode.TreeItemCollapsibleState.None);
    }
}

@injectable()
export class ScriptExplorerProvider implements vscode.TreeDataProvider<ScriptItem>, IScriptExplorerProvider {

    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
    ) {}

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | null | undefined> | undefined;
    
    getTreeItem(element: ScriptItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem): Promise<ScriptItem[]> {
        if(!element) {
            const scripts = await this.connectionService.downloadAllScripts();
            const scriptItems = this.convertToScriptItems(scripts);
            return scriptItems;   
        }

        return Promise.resolve([]);
    }

    private convertToScriptItems(scriptOjbects: ScriptObject[]): ScriptItem[] {
        return scriptOjbects.map(this.convertToScriptItem);
    }

    private convertToScriptItem(scriptObject: ScriptObject): ScriptItem {
        return new ScriptItem(scriptObject.value);
    }
}