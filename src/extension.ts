import * as vscode from 'vscode';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { inject, injectable } from 'inversify';

import { Config } from './models/config';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import TYPES from './types';
import container from './inversify.config';

var socketio = require('socket.io-client')('http://localhost:8084');

// https://rpeshkov.net/blog/vscode-extension-di/
// https://github.com/inversify/InversifyJS

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const configService = container.get<IConfigService>(TYPES.services.config);
	const connectionService = container.get<IConnectionService>(TYPES.services.connection);

	var config: Config = await configService.read();
	if (!config) {
		config = await configService.createConfigInteractivly();
		if (config) {
			await configService.write(config);
		}
	}

	await connectionService.connect(vscode.Uri.parse(`${config.ioBrokerUrl}:${config.socketIoPort}`));
	const scripts = await connectionService.downloadAllScripts();



	// socketio.on("stateChange", (id: string, value: any) => {
	// 	console.log(`State: ${id}: ${JSON.stringify(value)}`);
	// });

	// socketio.on("objectChange", (id: string, value: any) => {
	// 	console.log(`Object: ${id}: ${JSON.stringify(value)}`);
	// });

	// socketio.on('connect', () => {
	// 	socketio.emit("subscribeObjects", "script.js.Util.*", () => {
	// 	});

	// 	socketio.emit("getObjectView", "system","script",{"startkey":"script.js.","endkey":"script.js.\u9999"}, (err: any, doc: any) => {

	// 	});

	// 	socketio.emit("getObject", "script.js", (a: any, b: any) => {
	// 		// vscode.workspace.openTextDocument({language: "js", content: b.common.source});

	// 		// b.common.source = 'console.log("Hello World!");\n';
	// 		// b.common.name = "test123";
	// 		// b.common.enabled = true;
	// 		// b._id = "script.js.Util.test123";

	// 		// socketio.emit("setObject", "script.js.Util.test123", b);
	// 		// console.log("Set object");
	// 	});
	// });

	addCommand("iobroker-javascript.download", () => {
		console.log("Download not implemented");
	});

	addCommand("iobroker-javascript.upload", () => {
		console.log("Upload not implemented");
	});

	addCommand("iobroker-javascript.startScript", () => {
		console.log("Start not implemented");
	});

	addCommand("iobroker-javascript.stopScript", () => {
		console.log("Stop not implemented");
	});

	function addCommand(command: string, callback: (...args: any[]) => any) {
		let disposable = vscode.commands.registerCommand(command, callback);
		context.subscriptions.push(disposable);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
