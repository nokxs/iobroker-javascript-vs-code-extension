import { IScript } from "../../models/IScript";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { inject, injectable } from "inversify";
import TYPES from '../../Types';
import { IScriptChangedEventListener as IScriptChangedEventListener } from './IScriptChangedListener';
import { IScriptIdService } from '../scriptId/IScriptIdService';
import { IScriptRemoteService } from './IScriptRemoteService';
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IDirectory } from "../../models/IDirectory";
import { IDirectoryService } from "../directory/IDirectoryService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { EngineType } from "../../models/EngineType";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IWorkspaceService } from "../workspace/IWorkspaceService";
import { promises as fs } from 'fs';
import * as path from 'path';

export const SECRET_PLACEHOLDER_PATTERN = /__IOBROKER_SECRET_([A-Za-z0-9_]+)__/g;
const SECRET_PLACEHOLDER_EXISTS_PATTERN = /__IOBROKER_SECRET_([A-Za-z0-9_]+)__/;

export function replaceSecretPlaceholders(scriptSource: string, envContent: string): string {
    const env = parseEnvContent(envContent);

    return scriptSource.replace(SECRET_PLACEHOLDER_PATTERN, (placeholder, key) => {
        return env.has(key) ? env.get(key)! : placeholder;
    });
}

function parseEnvContent(envContent: string): Map<string, string> {
    const env = new Map<string, string>();
    const lines = envContent.split(/\r?\n/);

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmedLine.indexOf("=");
        if (separatorIndex <= 0) {
            return;
        }

        const key = trimmedLine.substring(0, separatorIndex).trim();
        const rawValue = trimmedLine.substring(separatorIndex + 1).trim();
        const value = removeWrappingQuotes(rawValue);
        env.set(key, value);
    });

    return env;
}

function removeWrappingQuotes(value: string): string {
    if (value.length >= 2) {
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length - 1);
        }
    }

    return value;
}

@injectable()
export class ScriptRemoteService implements IScriptRemoteService, IConnectionEventListener {
    private scriptEventListeners: Array<IScriptChangedEventListener> = new Array();

    constructor(
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.scriptId) private scriptIdService: IScriptIdService,
        @inject(TYPES.services.directory) private directoryService: IDirectoryService,
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) { }

    init(): void {
        this.connectionServiceProvider.getConnectionService().registerConnectionEventListener(this);

        if (this.connectionServiceProvider.getConnectionService().isConnected) {
            this.registerSocketEvents();
        }
    }

    registerScriptChangedEventListener(listener: IScriptChangedEventListener): void {
        if (this.scriptEventListeners.includes(listener)) {
            return;
        }

        this.scriptEventListeners.push(listener);
    }

    downloadAllScripts(): Promise<IScript[]> {
        return this.connectionServiceProvider.getConnectionService().getSystemObjectView<IScript>("script", "script.js.", "script.js.");
    }

    async downloadScriptWithUri(scriptUri: Uri): Promise<IScript> {
        const scriptId = this.scriptIdService.getIoBrokerId(scriptUri);
        return await this.downloadScriptWithId(scriptId);
    }

    downloadScriptWithId(scriptId: ScriptId): Promise<IScript> {
        return this.connectionServiceProvider.getConnectionService().getObject<IScript>(scriptId);
    }

    async uploadScript(script: IScript): Promise<void> {
        script.common.engineType = this.getFixedEngineTypeCasing(script.common.engineType);
        script.common.source = await this.replaceSecretsFromDotEnvFile(script.common.source ?? "");

        if (this.configRepositoryService.config.scriptAutoRun) {
            script.common.enabled = true;
        }

        await this.directoryService.createDirectoriesRecursively(script._id);
        await this.connectionServiceProvider.getConnectionService().setObject(<string>script._id, script);
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
            await this.connectionServiceProvider.getConnectionService().extendObject(scriptId, script);
        } else {
            throw new Error(`Could not update script '${scriptId}', because it is not known to ioBroker`);
        }
    }

    async delete(scriptId: ScriptId): Promise<void> {
        return await this.connectionServiceProvider.getConnectionService().deleteObject(scriptId);
    }

    onConnected(): void {
        this.registerSocketEvents();
    }

    onDisconnected(): void {
        this.unregisterSocketEvents();
        this.scriptEventListeners.forEach(listener => listener.onNoScriptAvailable());
    }

    onReAuthenticate(): void {
    }

    private registerSocketEvents(): void {
        this.connectionServiceProvider.getConnectionService().registerForObjectChange("script.js.*", (id: string) => {
            this.scriptEventListeners.forEach(listener => listener.onScriptChanged(id));
        });
    }

    private unregisterSocketEvents(): void {
        this.connectionServiceProvider.getConnectionService().unregisterObjectChange("script.js.*");
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

    private getFixedEngineTypeCasing(engineType: string | undefined): string {
        switch (engineType?.toLowerCase()) {
            case EngineType.typescript:
                return "TypeScript/ts";
            case EngineType.javascript:
                return "Javascript/js";
            case EngineType.blockly:
                return "Rules";
            case EngineType.rules:
                return "Blockly";
        }

        return "";
    }

    private async replaceSecretsFromDotEnvFile(scriptSource: string): Promise<string> {
        if (!SECRET_PLACEHOLDER_EXISTS_PATTERN.test(scriptSource)) {
            return scriptSource;
        }

        const workspacePath = this.workspaceService.workspaceToUse?.uri?.fsPath;
        if (!workspacePath) {
            return scriptSource;
        }

        const envPath = path.join(workspacePath, ".env");
        try {
            return replaceSecretPlaceholders(scriptSource, await fs.readFile(envPath, "utf8"));
        } catch {
            return scriptSource;
        }
    }
}
