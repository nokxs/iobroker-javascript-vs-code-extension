import * as vscode from 'vscode';

import { IDirectory } from '../../models/IDirectory';

export class ScriptDirectory extends vscode.TreeItem {
    
    contextValue = "scriptDirectory";
    iconPath = new vscode.ThemeIcon("folder-opened");

    constructor(public directory: IDirectory, private collapse: boolean) {
        super(directory.common?.name ?? "INVALID", collapse ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
    }
}
