import * as path from 'path';
import * as vscode from 'vscode';

import { getEngineTypeInfo } from '../../models/EngineType';
import { getJsInstanceNumber } from '../../models/Engine';
import { ILocalScript } from '../../models/ILocalScript';
import { IScript } from "../../models/IScript";

export class ScriptItem extends vscode.TreeItem {

    contextValue = "scriptItem";

    constructor(public script: ILocalScript) {
        super("", vscode.TreeItemCollapsibleState.None);
        
        this.id = <string>script._id;
        this.description = this.getDescription(script);
        this.label = this.getScriptName(script.ioBrokerScript);
        this.iconPath = this.getIconPath(script.ioBrokerScript);
        this.command = {
            title: "Open script",
            command: "iobroker-javascript.openFile",
            arguments: [
                script
            ]
        };
    }

    private getIconPath(script: IScript): string | undefined {
        const icon = getEngineTypeInfo(script.common.engineType)?.icon;

        return icon ? path.join(__filename, '..', '..', 'resources', icon) : undefined;
    }

    private getScriptName(script: IScript) {
        const name = script.common?.name ?? "INVALID NAME";
        const state = script.common.enabled ? "▶️" : "⏹️";
        const jsInstanceNumber = getJsInstanceNumber(script.common?.engine);

        return `${state} [${jsInstanceNumber}] ${name}`;
    }

    private getDescription(script: ILocalScript): string | undefined {
        if (script.isRemoteOnly) {
            return "(only remote)";
        }
        
        return script.isDirty ? "*" : undefined;
    }
}
