import * as WebSocket from 'ws';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// require('./conn.js');
import { servConn } from './conn';
import { workspace } from 'vscode';

var socketio = require('socket.io-client')('http://localhost:8084');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// const socket = new WebSocket(`ws://iobroker:8081/socket.io/?ws=true&EIO=3&transport=websocket`);
	// const socket = new WebSocket("ws://iobroker:8084");
	
// 4216["extendObject","script.js.Util.test",{"common":{"engine":"system.adapter.javascript.0","enabled":false,"source":"var isNight = compareTime(\"night\", \"nightEnd\", \"between\");\nlog(`Is it night:: ${isNight}`);\n","debug":false,"verbose":false},"from":"system.adapter.admin.0"}]

	socketio.on("stateChange", (id: string, value: any) => {
		console.log(`State: ${id}: ${JSON.stringify(value)}`);
	});

	socketio.on("objectChange", (id: string, value: any) => {
		console.log(`Object: ${id}: ${JSON.stringify(value)}`);
	});

	socketio.on('connect', () => {
		socketio.emit("subscribeObjects", "script.js.Util.*", () => {
			socketio.emit("getObject", "script.js.Util.test", (a: any, b: any) => {
				workspace.openTextDocument({language: "js", content: b.common.source});

				b.common.source = "Test";
				socketio.emit("setObject", "script.js.Util.test", b);
				console.log("Set object");
			});
		});	
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('iobroker-javascript.helloWorld', () => {
		console.log("Send message");
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
