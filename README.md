# VS Code extension for ioBroker javascript adapter

[ioBroker](https://www.iobroker.net/) is a mighty IoT platform and enables you to write custom scripts with its [JavaScript adapter](https://github.com/ioBroker/ioBroker.javascript). 

This extension for [Visual Studio Code](https://code.visualstudio.com/) enables you to develop the scripts completely in Visual Studio Code, without the need of the web interface. 

![Script Explorer](https://media.githubusercontent.com/media/nokxs/iobroker-javascript-vs-code-extension/main/doc/script-explorer.gif)

## Features

Open the command pallet (<kbd>Strg</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> OR <kbd>F1</kbd>) and type `iobroker: ` to see all available commands.

After the extension is invoked the first time, the extension has to be configured interactively. You can see the process
in the gif above. If your connection fails, check the created file `iobroker-config.json` and run the command `iobroker: Connect to ioBroker` for another connection attempt.

> Current limitation: ioBroker instances with a password are not supported yet!

### Type definitions

If you choose to configure ioBroker type definitions, the current defintions are downloaded from [GitHub](https://github.com/ioBroker/ioBroker.javascript/blob/master/lib/javascript.d.ts). Additionaly a `tsconfig.json` is created
(if it does not exist yet) and the definition is added as `typeRoot`. This enables Visual Studio Code to know
the [ioBroker specific javascript functions](https://github.com/ioBroker/ioBroker.javascript/blob/master/docs/en/javascript.md).

> This does not work well yet and will be improved in the future

### Script explorer
The script explorer can be found in the activity bar behind the ioBroker logo. It shows all scripts, which are on
the configured iobroker server.

Click on script to show its contents. If the script is not downloaded yet, only a preview is openend. 

Every time a script object is changed, the script explorer refreshes its view.

### Download scripts
Either download only one script (`iobroker: Download script`) or all scripts at once (`iobroker: Download all scripts`).
To download a single script you have to following options:

* Go to the script explorer and press the download button
* Use the command `iobroker: Download script`. This command is only for updating an existing script as it downloads 
the script in the active text editor.

### Upload scripts
To upload a single script you have the following options:

* Go to the script explorer and press the upload button. This will only work, if the script resides on your disk.
* Use the command `iobroker: Upload script`. This command uploads the script in the active text editor.

> Current limition: It is not possible to create a new script and upload it. This feature will be added in a future release.
### Start/Stop scripts
To start/stop a single script you have the following options:

* Go to the script explorer and press the start or stop button.
* Use the command `iobroker: Start script`, respectively `iobroker: Stop script`. This command starts/stops the script in the active text editor.

### Show script logging
Press <kbd>Strg</kbd> + <kbd>Shift</kbd> + <kbd>U</kbd> to open the "Output" view. Open the drop down and select `ioBroker (all)`.

As long as a connection to ioBroker exists, this will show the output of all scripts.

## Extension Settings

After the first activation a `.iobroker-config.json` file is created in the root directory of your workspace. It contains all settings. The idea is to use a SCM tool like git and check this in.

### Available settings

* `ioBrokerUrl`: The url has to be prefixed with http/https. Specify no port here
* `socketIoPort`: Use the port of the admin adapter (usually 8081). Do not use the port of the socket.io Adapter (usually 8084) as this will not work, because of missing permissions.
* `workspaceSubPath`: Not supported yet

## Known Issues

If you got any problems, please open a GitHub issue.

## Planned features

Support (not in the listed order)
* password protected ioBroker installations
* the setting `workspaceSubPath` to place scripts not in the root directory of the workspace
* renaming of scripts
* creating of new scripts
* deleting of scripts
* multiple js-Adapter instances
* syncing of workspace with remote scripts (correclty, delete and remove scirpts)
* upload multiple changed scripts with an `upload all` command
* reordering of scripts in the script explorer
* script output only for the currently selected script

## Release Notes

See the section [Releases on Github](https://github.com/nokxs/iobroker-javascript-vs-code-extension/releases) for release notes.
