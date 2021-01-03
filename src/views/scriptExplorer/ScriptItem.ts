import * as path from 'path';
import * as vscode from 'vscode';

import { Script } from "../../models/Script";

export class ScriptItem extends vscode.TreeItem {

    constructor(public script: Script) {
        super("", vscode.TreeItemCollapsibleState.None);
        this.label = this.getScriptName(script);

        if (script.common.engineType === "Javascript/js") {
            this.iconPath = this.getJsIcon();
        } else if (script.common.engineType === "TypeScript/ts") {
            this.iconPath = this.getTsIcon();
        } else if (script.common.engineType === "Blockly") {
            this.iconPath = this.getBlocklyIcon();
        }

        this.command = {
            title: "Open script",
            command: "iobroker-javascript.openFile",
            arguments: [
                script
            ]
        };
    }

    private getScriptName(script: Script) {
        const name = script.common?.name ?? "INVALID NAME";
        const state = script.common.enabled ? "▶" : "❚❚";

        return `${state} ${name}`;
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
}
