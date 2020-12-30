import { ExtensionContext } from "vscode";
import * as vscode from 'vscode';

import { ICommandService } from "./ICommandService";
import { injectable, multiInject } from "inversify";
import TYPES from "../../types";
import { ICommand } from "../../commands/ICommand";

@injectable()
export class CommandService implements ICommandService {
    constructor(
        @multiInject(TYPES.command) private commands: ICommand[]
    ) {}
    
    registerCommands(context: ExtensionContext): void {
        for (const c of this.commands) {
            const cmd = vscode.commands.registerCommand(c.id, c.execute, c);
            context.subscriptions.push(cmd);
        }
    }
}