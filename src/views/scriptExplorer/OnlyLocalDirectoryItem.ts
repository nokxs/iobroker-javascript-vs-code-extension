import * as path from 'path';
import * as vscode from 'vscode';

export class OnlyLocalDirectoryItem extends vscode.TreeItem {

    contextValue = "onlyLocalDirectoryItem";

    constructor(public directoryUri: vscode.Uri) {
        super("", vscode.TreeItemCollapsibleState.None);
        
        this.description =  `${path.basename(directoryUri.fsPath)} (only local)`;
    }

}
