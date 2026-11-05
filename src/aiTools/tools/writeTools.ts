import { BaseTool, InvocationDescription } from "./BaseTool";
import { createScript } from "../core/createScript";
import { deleteScript } from "../core/deleteScript";
import { downloadScript } from "../core/downloadScript";
import { moveScript } from "../core/moveScript";
import { renameScript } from "../core/renameScript";
import { startScript, stopScript } from "../core/startStopScript";
import { uploadAllChangedScripts, uploadScript } from "../core/uploadScript";
import {
    CreateScriptInput,
    DeleteScriptInput,
    DownloadScriptInput,
    MoveScriptInput,
    RenameScriptInput,
    StartStopScriptInput,
    ToolOutcome,
    UploadAllChangedScriptsInput,
    UploadScriptInput
} from "../core/types";

function code(value: unknown): string {
    return `\`${value}\``;
}

/** Base class for the tools that modify scripts and therefore have to refresh the script explorer. */
abstract class WriteTool<TInput> extends BaseTool<TInput> {
    protected readonly changesScripts = true;
}

export class UploadScriptTool extends WriteTool<UploadScriptInput> {
    readonly name = "iobroker_upload_script" as const;

    protected run(input: UploadScriptInput): Promise<ToolOutcome<unknown>> {
        return uploadScript(this.deps, input);
    }

    protected describe(input: UploadScriptInput): InvocationDescription {
        return {
            title: "Upload script to ioBroker",
            message: `Upload ${code(input.scriptId)} from disk to the ioBroker server? The server version will be overwritten.`
        };
    }
}

export class UploadAllChangedScriptsTool extends WriteTool<UploadAllChangedScriptsInput> {
    readonly name = "iobroker_upload_all_changed_scripts" as const;

    protected run(): Promise<ToolOutcome<unknown>> {
        return uploadAllChangedScripts(this.deps);
    }

    protected describe(): InvocationDescription {
        return {
            title: "Upload all changed scripts to ioBroker",
            message: "Upload every script whose local file differs from the ioBroker server? The server versions will be overwritten."
        };
    }
}

export class DownloadScriptTool extends WriteTool<DownloadScriptInput> {
    readonly name = "iobroker_download_script" as const;

    protected run(input: DownloadScriptInput): Promise<ToolOutcome<unknown>> {
        return downloadScript(this.deps, input);
    }

    protected describe(input: DownloadScriptInput): InvocationDescription {
        return {
            title: "Download script from ioBroker",
            message: `Overwrite the local file of ${code(input.scriptId)} with the content from the ioBroker server?`
        };
    }
}

export class StartScriptTool extends WriteTool<StartStopScriptInput> {
    readonly name = "iobroker_start_script" as const;

    protected run(input: StartStopScriptInput): Promise<ToolOutcome<unknown>> {
        return startScript(this.deps, input);
    }

    protected describe(input: StartStopScriptInput): InvocationDescription {
        return {
            title: "Start script on ioBroker",
            message: `Enable and start ${code(input.scriptId)} on the ioBroker server?`
        };
    }
}

export class StopScriptTool extends WriteTool<StartStopScriptInput> {
    readonly name = "iobroker_stop_script" as const;

    protected run(input: StartStopScriptInput): Promise<ToolOutcome<unknown>> {
        return stopScript(this.deps, input);
    }

    protected describe(input: StartStopScriptInput): InvocationDescription {
        return {
            title: "Stop script on ioBroker",
            message: `Disable and stop ${code(input.scriptId)} on the ioBroker server?`
        };
    }
}

export class CreateScriptTool extends WriteTool<CreateScriptInput> {
    readonly name = "iobroker_create_script" as const;

    protected run(input: CreateScriptInput): Promise<ToolOutcome<unknown>> {
        return createScript(this.deps, input);
    }

    protected describe(input: CreateScriptInput): InvocationDescription {
        const directory = input.directoryId ? code(input.directoryId) : "the root directory";
        return {
            title: "Create script in ioBroker",
            message: `Create ${code(input.fileName)} (${input.language}) in ${directory}? The script is created on the ioBroker server and as a local file.`
        };
    }
}

export class RenameScriptTool extends WriteTool<RenameScriptInput> {
    readonly name = "iobroker_rename_script" as const;

    protected run(input: RenameScriptInput): Promise<ToolOutcome<unknown>> {
        return renameScript(this.deps, input);
    }

    protected describe(input: RenameScriptInput): InvocationDescription {
        return {
            title: "Rename script",
            message: `Rename ${code(input.scriptId)} to ${code(input.newName)} on the ioBroker server and on disk?`
        };
    }
}

export class MoveScriptTool extends WriteTool<MoveScriptInput> {
    readonly name = "iobroker_move_script" as const;

    protected run(input: MoveScriptInput): Promise<ToolOutcome<unknown>> {
        return moveScript(this.deps, input);
    }

    protected describe(input: MoveScriptInput): InvocationDescription {
        return {
            title: "Move script",
            message: `Move ${code(input.scriptId)} to ${code(input.targetDirectoryId)} on the ioBroker server and on disk?`
        };
    }
}

export class DeleteScriptTool extends WriteTool<DeleteScriptInput> {
    readonly name = "iobroker_delete_script" as const;

    protected run(input: DeleteScriptInput): Promise<ToolOutcome<unknown>> {
        return deleteScript(this.deps, input);
    }

    protected describe(input: DeleteScriptInput): InvocationDescription {
        return {
            title: "Delete script",
            message: `Delete ${code(input.scriptId)} on the ioBroker server and on disk? This cannot be undone.`
        };
    }
}
