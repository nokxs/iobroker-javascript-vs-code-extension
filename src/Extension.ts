import * as vscode from 'vscode';

import { IStartup } from './IStartup';
import TYPES from './Types';
import container from './Inversify.config';

export async function activate(context: vscode.ExtensionContext) {

	container.bind<vscode.ExtensionContext>(TYPES.extensionContext).toConstantValue(context);
	
	await container.get<IStartup>(TYPES.startup).init(context);
}

export function deactivate() {}
