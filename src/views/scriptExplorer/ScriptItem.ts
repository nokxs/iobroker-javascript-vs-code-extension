import * as path from 'path';
import * as vscode from 'vscode';

import { EngineType } from '../../models/EngineType';
import { ILocalScript } from '../../models/ILocalScript';
import { IScript } from "../../models/IScript";

export class ScriptItem extends vscode.TreeItem {

    contextValue = "scriptItem";

    constructor(public script: ILocalScript) {
        super("", vscode.TreeItemCollapsibleState.None);
        
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
        switch (script.common.engineType?.toLowerCase()) {
            case EngineType.javascript:
                return this.getJsIcon();
            case EngineType.typescript:
                return this.getTsIcon();
            case EngineType.blockly:
                return this.getBlocklyIcon();
            case EngineType.rules:
                return this.getRulesIcon();
            default:
                return undefined;
        }
    }

    private getScriptName(script: IScript) {
        const name = script.common?.name ?? "INVALID NAME";
        const state = script.common.enabled ? "▶" : "❚❚";
        const jsInstanceNumber = this.getJsInstanceNumber(script.common?.engine);

        return `${state} [${jsInstanceNumber}] ${name}`;
    }

    private getJsIcon(): string {
        return path.join(__filename, '..', '..', 'resources', 'javascript.svg');
    }

    private getTsIcon(): string {
        return path.join(__filename, '..', '..', 'resources', 'typescript.svg');
    }

    private getBlocklyIcon(): string {
        return path.join(__filename, '..', '..', 'resources', 'blockly.svg');
    }

    private getRulesIcon(): string {
        return path.join(__filename, '..', '..', 'resources', 'rules.svg');
    }

    private getJsInstanceNumber(engine: string | undefined): number {
        if (engine) {
            const lastDot = engine.lastIndexOf(".");
            const number = engine.substring(lastDot + 1);
            return Number.parseInt(number);            
        }

        return 0;
    }

    private getDescription(script: ILocalScript): string | undefined {
        if (script.isRemoteOnly) {
            return "(only remote)";
        }
        
        return script.isDirty ? "*" : undefined;
    }
}
