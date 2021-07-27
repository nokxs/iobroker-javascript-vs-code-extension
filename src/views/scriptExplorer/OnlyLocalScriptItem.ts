import * as path from 'path';
import * as vscode from 'vscode';

export class OnlyLocalScriptItem extends vscode.TreeItem {

    contextValue = "onlyLocalScriptItem";

    constructor(public fileUri: vscode.Uri) {
        super("", vscode.TreeItemCollapsibleState.None);
        
        this.description =  `${path.basename(fileUri.fsPath)} (only local)`;
    }

}
