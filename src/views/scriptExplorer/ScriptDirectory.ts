import * as vscode from 'vscode';

export class ScriptDirectory extends vscode.TreeItem {
    iconPath = new vscode.ThemeIcon("folder-opened");

    constructor(public name: string, public path: string, private collapse: boolean) {
        super(name, collapse ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
    }
}
