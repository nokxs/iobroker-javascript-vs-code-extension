import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IScriptChangedEventListener as IScriptChangedEventListener } from './IScriptChangedListener';
import { IScriptIdService } from '../scriptId/IScriptIdService';
import { IScriptRemoteService } from './IScriptRemoteService';
import { IConnectionService } from '../connection/IConnectionService';
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IDirectory } from "../../models/IDirectory";

@injectable()
export class ScriptRemoteService implements IScriptRemoteService, IConnectionEventListener {
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();
    
    constructor(
        @inject(TYPES.services.connection) private connectionService: IConnectionService,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
    ) {
        connectionService.registerConnectionEventListener(this);
    }

    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        this.scriptEventListeners.push(listener);
    }

    downloadAllScripts(): Promise<IScript[]> {
        return this.connectionService.getSystemObjectView<IScript>("script", "script.js.", "script.js.");
    }

    async downloadScriptWithUri(scriptUri: Uri): Promise<IScript> {
        const scriptId = this.scriptIdService.getIoBrokerId(scriptUri);
        return await this.downloadScriptWithId(scriptId);
    }

    downloadScriptWithId(scriptId: ScriptId): Promise<IScript> {
        return this.connectionService.getObject<IScript>(scriptId);
    }

    uploadScript(script: IScript): Promise<void> {
        return this.connectionService.setObject(<string>script._id, script);
    }

    startScript(scriptId: ScriptId): Promise<void> {
        return this.setScriptState(scriptId, true);
    }

    stopScript(scriptId: ScriptId): Promise<void> {
        return this.setScriptState(scriptId, false);
    }

    async rename(scriptId: ScriptId, name: string): Promise<void> {
        const splittedId = scriptId.split(".");
        const sanatizedName = (name || '').replace(/[\\/\][*,;'"`<>?\s]/g, '_'); // Taken from https://github.com/ioBroker/ioBroker.javascript/blob/be43a91e002cb13f7c24aac4eebd482159bc4390/src/src/Dialogs/Rename.js#L47

        splittedId.splice(-1, 1);
        splittedId.push(sanatizedName);
        const newId = splittedId.join(".");

        const script = await this.downloadScriptWithId(scriptId);
        script._id = new ScriptId(newId);
        script.common.name = name;

        await this.delete(scriptId);
        await this.uploadScript(script);
    }

    async move(scriptId: ScriptId, targetDirectory: IDirectory): Promise<void> {
        const script = await this.downloadScriptWithId(scriptId);
        const scriptIdName = scriptId.substring(scriptId.lastIndexOf(".") + 1);

        await this.delete(scriptId);
        script._id = new ScriptId(`${targetDirectory._id}.${scriptIdName}`);
        await this.uploadScript(script);
    }

    async update(scriptId: ScriptId, script: IScript): Promise<void> {
        const existingScript = await this.downloadScriptWithId(scriptId);
        if (existingScript) {
            await this.connectionService.extendObject(scriptId, script);
        } else {
            throw new Error(`Could not update script '${scriptId}', because it is not known to ioBroker`);
        }
    }

    async delete(scriptId: ScriptId): Promise<void> {
        return this.connectionService.deleteObject(scriptId);
    }
    
    onConnected(): void {
        this.registerSocketEvents();
    }

    onDisconnected(): void {
        this.unregisterSocketEvents();
    }

    private registerSocketEvents(): void {
        this.connectionService.registerForObjectChange("script.js.*", (id: string, value: any) => {
            this.scriptEventListeners.forEach(listener => listener.onScriptChanged(id, value));
        });
    }

    private unregisterSocketEvents(): void {
        this.connectionService.unregisterObjectChange("script.js.*");
    }

    private async setScriptState(scriptId: ScriptId, isEnabled: boolean): Promise<void> {
        const script: IScript = {
            _id: scriptId,
            common: {
                enabled: isEnabled
            }
        };

        this.update(scriptId, script);
    }
    
    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
