import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptChangedEventListener } from '../../services/scriptRemote/IScriptChangedListener';
import { IIobrokerConnectionService } from '../../services/iobrokerConnection/IIobrokerConnectionService';
import { IScriptRepositoryService } from '../../services/scriptRepository/IScriptRepositoryService';
import { ILocalScript } from '../../models/ILocalScript';
import { ScriptItem } from '../scriptExplorer/ScriptItem';
import { IChangedScriptsProvider } from './IChangedScriptsProvider';

@injectable()
export class ChangedScriptsProvider implements vscode.TreeDataProvider<ScriptItem>, IChangedScriptsProvider, IScriptChangedEventListener {

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | undefined | null | void> = new vscode.EventEmitter<ScriptItem | undefined | null | void>();
    private _scriptCountCallback?: (count: number) => void;

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService
    ) {
        scriptRepositoryService.registerScriptChangedEventListener(this);
    }

    getTreeItem(element: ScriptItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(): Promise<Array<ScriptItem>> {
        if (!this.iobrokerConnectionService.isConnected()) {
            return Promise.resolve([]);
        }

        return await this.getChangedScriptItems();
    }

    onScriptCountChanged(callback: (count: number) => void): void {
        this._scriptCountCallback = callback;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    onScriptChanged(): void {
        this.refresh();
    }

    onNoScriptAvailable(): void {
        this.refresh();
    }

    private async getChangedScriptItems(): Promise<Array<ScriptItem>> {
        const scripts = this.scriptRepositoryService.getAllChangedScripts();
        this.notifyScriptCountChange(scripts);
        return this.convertToScriptItems(scripts);
    }

    private notifyScriptCountChange(scripts: ILocalScript[]): void {
        if (this._scriptCountCallback) {
            this._scriptCountCallback(scripts.length);
        }
    }

    private convertToScriptItems(scripts: ILocalScript[]): ScriptItem[] {
        return scripts.map(s => new ScriptItem(s));
    }
}
