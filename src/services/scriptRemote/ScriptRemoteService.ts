import { Script } from "../../models/Script";
import { ScriptObject } from "../../models/ScriptObject";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IScriptChangedEventListener as IScriptChangedEventListener } from './IScriptChangedListener';
import { IScriptIdService } from '../scriptId/IScriptIdService';
import { IScriptRemoteService } from './IScriptRemoteService';
import { IConnectionService } from '../connection/IConnectionService';
import { IConnectionEventListener } from "../connection/IConnectionEventListener";

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

    async downloadAllScripts(): Promise<Script[]> {
        const scriptOjbects = await this.connectionService.getSystemObjectView<ScriptObject>("script", "script.js.", "script.js.");
        return scriptOjbects.map(so => so.value);
    }

    async downloadScriptWithUri(scriptUri: Uri): Promise<Script> {
        const scriptId = this.scriptIdService.getIoBrokerId(scriptUri);
        return await this.downloadScriptWithId(scriptId);
    }

    downloadScriptWithId(scriptId: ScriptId): Promise<Script> {
        return this.connectionService.getObject<Script>(scriptId);
    }

    uploadScript(script: Script): Promise<void> {
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

        // TODO: For correct sanatazion much more characters have to be replaced. This part of the function should be moved to an own function.
        let sanatizedName = this.replaceAll(name, " ", "_");
        sanatizedName = this.replaceAll(sanatizedName, ".", "_");

        splittedId.splice(-1,1);
        splittedId.push(sanatizedName);
        const newId = splittedId.join(".");

        const script = await this.downloadScriptWithId(scriptId);
        script._id = newId;
        script.common.name = name;

        await this.deleteScript(scriptId);
        await this.uploadScript(script);
    }

    async updateScript(scriptId: ScriptId, script: Script): Promise<void> {
        const existingScript = await this.downloadScriptWithId(scriptId);
        if (existingScript) {
            await this.connectionService.extendObject(scriptId, script);
        } else {
            throw new Error(`Could not update script '${scriptId}', because it is not known to ioBroker`);
        }
    }

    async deleteScript(scriptId: ScriptId): Promise<void> {
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
        const script: Script = {
            _id: scriptId,
            common: {
                enabled: isEnabled
            }
        };

        this.updateScript(scriptId, script);
    }
    
    private replaceAll(s: string, searchValue: string, replaceValue: string): string {
        return s.split(searchValue).join(replaceValue);
    }
}
