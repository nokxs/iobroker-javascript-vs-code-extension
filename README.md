# VS Code extension for ioBroker javascript adapter

[ioBroker](https://www.iobroker.net/) is a mighty IoT platform and enables you to write custom scripts with its [JavaScript adapter](https://github.com/ioBroker/ioBroker.javascript). 

This extension for [Visual Studio Code](https://code.visualstudio.com/) enables you to develop the scripts completely in Visual Studio Code, without the need of the web interface. 

![Script Explorer](https://media.githubusercontent.com/media/nokxs/iobroker-javascript-vs-code-extension/main/doc/script-explorer.gif)

## Features

Open the command pallet (<kbd>Strg</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> OR <kbd>F1</kbd>) and type `iobroker: ` to see all available commands.

Connect to your ioBroker instance by invoking the command `iobroker: Connect to ioBroker`. You can see the process in the gif above. If your connection fails, check the created file `.iobroker-config.json` and re-run the command `iobroker: Connect to ioBroker` for another connection attempt.

If `.iobroker-config.json` is found in the root of your workspace, the extension automatically starts a connection attempt.

> Current limitation: ioBroker instances with a password are not supported yet!

### Type definitions

If you choose to configure ioBroker type definitions, the current defintions are downloaded from [GitHub](https://github.com/ioBroker/ioBroker.javascript/blob/master/lib/javascript.d.ts). Additionaly a `tsconfig.json` is created
(if it does not exist yet) with the necessary settings. This enables Visual Studio Code to know
the [ioBroker specific javascript functions](https://github.com/ioBroker/ioBroker.javascript/blob/master/docs/en/javascript.md).

### Script explorer
The script explorer can be found in the activity bar behind the ioBroker logo. It shows all scripts, which are on the configured iobroker server.

Click on script to show its contents. If the script is not downloaded yet, only a preview is openend. 

Every time a script object is changed, the script explorer refreshes its view.

### Download scripts
Either download only one script (`iobroker: Download script`) or all scripts at once (`iobroker: Download all scripts`). To download a single script you have to following options:

* Go to the script explorer and press the download button next to the script you want to download
* Use the command `iobroker: Download script`. This command is only for updating an existing script as it downloads the script in the active text editor.

### Upload scripts
To upload a single script you have the following options:

* Go to the script explorer and press the upload button. This will only work, if the script resides on your disk.
* Use the command `iobroker: Upload script`. This command uploads the script in the active text editor.

### Start/Stop scripts
To start/stop a single script you have the following options:

* Go to the script explorer and press the start or stop button.
* Use the command `iobroker: Start script`, respectively `iobroker: Stop script`. This command starts/stops the script in the active text editor.

### Move scripts
Scripts can be moved from one directory to another on your ioBroker server. Moving a script over the VS Code file browser is not supported yet.

Scripts can only be moved over the script explorer. Right click on the script you want to move, select `Move` and choose the directory you want the script to move to.
If the script is synced to your local disk, it will also be moved there.

### Deleting scripts
Scripts can be deleted on your ioBroker server via the script explorer. Right click on a script, select `Delete` and confirm that the script shall be really be deleted. If the script is synced to
your local disk, it will also be deleted there.

### Change JS Instance
The JS Instance for a script can be changed over the script explorer. Right click on a script and select `Change instance` via a quick pick.

![JS Instance Number](https://media.githubusercontent.com/media/nokxs/iobroker-javascript-vs-code-extension/main/doc/js-instance-nr.jpg)

### Show script logging
Press <kbd>Strg</kbd> + <kbd>Shift</kbd> + <kbd>U</kbd> to open the "Output" view. Open the drop down and select `ioBroker (all)` or `ioBroker (current script)`.

* `ioBroker (all)`: As long as a connection to ioBroker exists, this will show the output of all scripts.
* `ioBroker (current script)`: As long as a connection to ioBroker exists, this will show only the outputs of the script in the currently active tab. This output gets not cleared, if the tab is changed. If you need to 
clear the output use Visual Studios feature `Clear Output`.

## Extension Settings

After the first activation a `.iobroker-config.json` file is created in the root directory of your workspace. It contains all settings.

> Current limitation: Hot reloading the settings is currently not supported. After changing a setting, restart VS Code.

### Available settings

An example with all available settings can be found [here](./doc/.iobroker-config.json).

| Key           | Description           | Mandatory | Default |
|---------------|-----------------------|-----------|---------|
| `ioBrokerUrl` | The url has to be prefixed with http/https. Specify no port here. | Yes |  |
| `socketIoPort` | Use the port of the admin adapter (usually 8081). Do not use the port of the socket.io Adapter (usually 8084) as this will not work, because of missing permissions. | Yes | |
| `scriptRoot` | Relative directory path, which is used as root of ioBroker scripts. | Yes | |
| `adminVersion` | The admin version to connect to. Valid values: `Admin4`, `Admin5` | Yes | |
| `scriptExplorer.collapseDirectoriesOnStartup` | Should the directories in the script explorer be collapsed on startup. | No | true |

## Known Issues

If you got any problems, please open a GitHub issue.

## Planned features

Support (not in the listed order)
* password protected ioBroker installations
* syncing of workspace with remote scripts (correctly, delete and remove scirpts)
* upload multiple changed scripts with an `upload all` command
* showing which scripts were updated and need to be uploaded

## Release Notes

See the section [Releases on Github](https://github.com/nokxs/iobroker-javascript-vs-code-extension/releases) for release notes.
