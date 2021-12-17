import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IScriptChangedEventListener } from '../../services/scriptRemote/IScriptChangedListener';
import { IIobrokerConnectionService } from '../../services/iobrokerConnection/IIobrokerConnectionService';
import { IScriptRepositoryService } from '../../services/scriptRepository/IScriptRepositoryService';
import { IDirectory } from '../../models/IDirectory';
import { RootDirectory } from '../../models/RootDirectory';
import { ILocalScript } from '../../models/ILocalScript';
import { IWorkspaceService } from '../../services/workspace/IWorkspaceService';
import { ILocalOnlyScriptRepositoryService } from '../../services/localOnlyScriptRepository/ILocalOnlyScriptRepositoryService';
import { IConfigRepositoryService } from '../../services/configRepository/IConfigRepositoryService';
import { ScriptItem } from '../scriptExplorer/ScriptItem';
import { IChangedFilesProvider } from './IChangedFilesProvider';

@injectable()
export class ChangedFilesProvider implements vscode.TreeDataProvider<ScriptItem>, IChangedFilesProvider, IScriptChangedEventListener {

    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | undefined | null | void> = new vscode.EventEmitter<ScriptItem | undefined | null | void>();

    onDidChangeTreeData?: vscode.Event<void | ScriptItem | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.services.iobrokerConnection) private iobrokerConnectionService: IIobrokerConnectionService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.localOnlyScriptRepository) private localOnlyScriptRepositoryService: ILocalOnlyScriptRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService
    ) {
        scriptRepositoryService.registerScriptChangedEventListener(this);
        
        vscode.workspace.onDidCreateFiles(() => this.refresh());
        vscode.workspace.onDidDeleteFiles(() => this.refresh());
    }
    
    getTreeItem(element: ScriptItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: ScriptItem): Promise<Array<ScriptItem>> {
        if(!element) {
            return this.getRootLevelItems();
        }

        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    onScriptChanged(): void {
        this.refresh();
    }

    private async getRootLevelItems(): Promise<Array<ScriptItem>> {
        const scripts = await this.scriptRepositoryService.getAllScripts();
        const dirtyScripts = scripts.filter(s => s.isDirty && !s.isRemoteOnly);
        
        return this.convertToScriptItems(dirtyScripts);
    }
    
    private convertToScriptItems(scripts: ILocalScript[]): ScriptItem[] {
        return scripts.map(s => new ScriptItem(s));
    }
}
