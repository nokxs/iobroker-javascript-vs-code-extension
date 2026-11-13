import * as vscode from 'vscode';

import { IStartup } from './IStartup';
import TYPES from './Types';
import container from './Inversify.config';
import { ILogService } from './services/log/ILogService';

export async function activate(context: vscode.ExtensionContext) {

	container.bind<vscode.ExtensionContext>(TYPES.extensionContext).toConstantValue(context);
	
	await container.get<IStartup>(TYPES.startup).init(context);
}

export function deactivate(): Thenable<void> | undefined {
	try {
		if (container.isBound(TYPES.services.log)) {
			return container.get<ILogService>(TYPES.services.log).disposeAsync();
		}
	} catch {
		/* container may not be ready */
	}
	return undefined;
}
