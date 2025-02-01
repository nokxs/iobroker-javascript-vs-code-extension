import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptChangedEventListener } from '../../services/scriptRemote/IScriptChangedListener';
import { IIobrokerConnectionService } from '../../services/iobrokerConnection/IIobrokerConnectionService';
import { IScriptRepositoryService } from '../../services/scriptRepository/IScriptRepositoryService';
import { ILocalScript } from '../../models/ILocalScript';
import { ScriptItem } from '../scriptExplorer/ScriptItem';
import { IChangedScriptsProvider } from './IChangedScriptsProvider';
import { IConfigRepositoryService } from '../../services/configRepository/IConfigRepositoryService';
import { IWorkspaceService } from '../../services/workspace/IWorkspaceService';

@injectable()
export class ChangedScriptsProvider implements vscode.TreeDataProvider<ScriptItem>, IChangedScriptsProvider, IScriptChangedEventListener {

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | undefined | null | void> = new vscode.EventEmitter<ScriptItem | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workSpaceService: IWorkspaceService
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

        return await this.getRootLevelItems();
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

    private async getRootLevelItems(): Promise<Array<ScriptItem>> {
        const scripts = this.scriptRepositoryService.getAllChangedScripts();
        return this.convertToScriptItems(scripts);
    }

    private convertToScriptItems(scripts: ILocalScript[]): ScriptItem[] {
        return scripts.map(s => new ScriptItem(s));
    }
}
