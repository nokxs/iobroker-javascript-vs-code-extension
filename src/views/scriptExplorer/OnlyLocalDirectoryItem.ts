import * as path from 'path';
import * as vscode from 'vscode';

import { ILocalOnlyScript } from '../../models/ILocalOnlyScript';

export class OnlyLocalDirectoryItem extends vscode.TreeItem {

    contextValue = "onlyLocalDirectoryItem";
    iconPath = new vscode.ThemeIcon("folder-opened");

    constructor(public directory: ILocalOnlyScript, collapse: boolean) {
        super("", collapse ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
        
        this.description =  `${path.basename(directory.path.fsPath)} (only local)`;
    }

}
