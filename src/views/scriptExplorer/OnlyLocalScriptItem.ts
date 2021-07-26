import * as vscode from 'vscode';

export class OnlyLocalScriptItem extends vscode.TreeItem {

    contextValue = "onlyLocalScriptItem";

    constructor(public fileName: string) {
        super("", vscode.TreeItemCollapsibleState.None);
        
        this.description =  `${fileName} (only local)`;
    }

}
