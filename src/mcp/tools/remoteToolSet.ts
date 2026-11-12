/* eslint-disable @typescript-eslint/naming-convention */
import type { Tool, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DESCRIPTIONS, TOOL_SCHEMAS, TOOL_TITLES } from "../../aiTools/schemas";
import type { ToolName } from "../../aiTools/schemas";
import type { ToolOutcome } from "../../aiTools/core/remote/types";
import type { RemoteToolDeps } from "../../aiTools/core/remote/types";
import { getJsInstances } from "../../aiTools/core/remote/getJsInstances";
import { getLogs } from "../../aiTools/core/remote/getLogs";
import { getScriptContent } from "../../aiTools/core/remote/getScriptContent";
import { getScripts } from "../../aiTools/core/remote/getScripts";
import { getState } from "../../aiTools/core/remote/getState";
import { createDirectory } from "../../aiTools/core/remote/createDirectory";
import { createScript } from "../../aiTools/core/remote/createScript";
import { deleteDirectory } from "../../aiTools/core/remote/deleteDirectory";
import { deleteScript } from "../../aiTools/core/remote/deleteScript";
import { moveScript } from "../../aiTools/core/remote/moveScript";
import { renameScript } from "../../aiTools/core/remote/renameScript";
import { startScript, stopScript } from "../../aiTools/core/remote/startStopScript";
import { updateScriptSource } from "../../aiTools/core/remote/updateScriptSource";
import type {
    CreateDirectoryInput,
    CreateScriptInput,
    DeleteDirectoryInput,
    DeleteScriptInput,
    GetJsInstancesInput,
    GetLogsInput,
    GetScriptContentInput,
    GetScriptsInput,
    GetStateInput,
    MoveScriptInput,
    RenameScriptInput,
    StartStopScriptInput,
    UpdateScriptSourceInput
} from "../../aiTools/core/remote/types";

/** The new tool that replaces the upload semantics of the extension. */
export const UPDATE_SCRIPT_SOURCE_TOOL = "iobroker_update_script_source";

/**
 * Exactly the tools the MCP server implements. Deliberately not `TOOL_NAMES`: that list has the
 * four sync tools, which have no remote counterpart, and lacks the new update tool.
 */
export const REMOTE_TOOL_NAMES = [
    "iobroker_get_scripts",
    "iobroker_get_script_content",
    "iobroker_get_js_instances",
    "iobroker_get_state",
    "iobroker_get_logs",
    "iobroker_start_script",
    "iobroker_stop_script",
    "iobroker_create_script",
    "iobroker_create_directory",
    "iobroker_rename_script",
    "iobroker_move_script",
    "iobroker_delete_script",
    "iobroker_delete_directory",
    UPDATE_SCRIPT_SOURCE_TOOL
] as const;

export type RemoteToolName = typeof REMOTE_TOOL_NAMES[number];

/** The input schema of the new tool. It is not contributed to package.json (see the design). */
export const REMOTE_TOOL_SCHEMAS = {
    [UPDATE_SCRIPT_SOURCE_TOOL]: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id, e.g. 'script.js.common.MyScript'. Use iobroker_get_scripts to look it up."
            },
            source: {
                type: "string",
                description: "The complete new source code of the script. It replaces the server version and is capped at 1 MB."
            }
        },
        required: ["scriptId", "source"],
        additionalProperties: false
    }
} as const;

const UPDATE_SCRIPT_SOURCE_TITLE = "Update ioBroker script source";
const UPDATE_SCRIPT_SOURCE_DESCRIPTION =
    "Replaces the source code of an existing script on the ioBroker server. Use iobroker_get_script_content " +
    "before editing so the rest of the script is preserved, and send the complete new source. Returns the " +
    "script id and the number of written characters. This cannot be undone; confirm the exact script id with " +
    "the user before using this tool.";

type RemoteToolHandler = (deps: RemoteToolDeps, input: Record<string, unknown>) => Promise<ToolOutcome<unknown>>;

const READ_ONLY_TOOLS: readonly RemoteToolName[] = [
    "iobroker_get_scripts",
    "iobroker_get_script_content",
    "iobroker_get_js_instances",
    "iobroker_get_state",
    "iobroker_get_logs"
];

/** `start`/`stop` write `common.enabled`, so they are not read-only but idempotent. */
const IDEMPOTENT_WRITE_TOOLS: readonly RemoteToolName[] = [
    "iobroker_start_script",
    "iobroker_stop_script"
];

const NON_DESTRUCTIVE_CREATE_TOOLS: readonly RemoteToolName[] = [
    "iobroker_create_script",
    "iobroker_create_directory"
];

const HANDLERS: Record<RemoteToolName, RemoteToolHandler> = {
    iobroker_get_scripts: (deps, input) => getScripts(deps, input as unknown as GetScriptsInput),
    iobroker_get_script_content: (deps, input) => getScriptContent(deps, input as unknown as GetScriptContentInput),
    iobroker_get_js_instances: (deps, input) => getJsInstances(deps, input as unknown as GetJsInstancesInput),
    iobroker_get_state: (deps, input) => getState(deps, input as unknown as GetStateInput),
    iobroker_get_logs: (deps, input) => getLogs(deps, input as unknown as GetLogsInput),
    iobroker_start_script: (deps, input) => startScript(deps, input as unknown as StartStopScriptInput),
    iobroker_stop_script: (deps, input) => stopScript(deps, input as unknown as StartStopScriptInput),
    iobroker_create_script: (deps, input) => createScript(deps, input as unknown as CreateScriptInput),
    iobroker_create_directory: (deps, input) => createDirectory(deps, input as unknown as CreateDirectoryInput),
    iobroker_rename_script: (deps, input) => renameScript(deps, input as unknown as RenameScriptInput),
    iobroker_move_script: (deps, input) => moveScript(deps, input as unknown as MoveScriptInput),
    iobroker_delete_script: (deps, input) => deleteScript(deps, input as unknown as DeleteScriptInput),
    iobroker_delete_directory: (deps, input) => deleteDirectory(deps, input as unknown as DeleteDirectoryInput),
    [UPDATE_SCRIPT_SOURCE_TOOL]: (deps, input) => updateScriptSource(deps, input as unknown as UpdateScriptSourceInput)
};

export function isRemoteToolName(name: string): name is RemoteToolName {
    return Object.prototype.hasOwnProperty.call(HANDLERS, name);
}

/** The read-only switch hides every tool that writes to ioBroker, `start`/`stop` included. */
export function isReadOnlyTool(name: RemoteToolName): boolean {
    return READ_ONLY_TOOLS.includes(name);
}

export function getRemoteToolHandler(name: RemoteToolName): RemoteToolHandler {
    return HANDLERS[name];
}

/** The static `tools/list` answer, filtered by the read-only switch. Pure, no IO. */
export function listRemoteTools(readOnly: boolean): Tool[] {
    return REMOTE_TOOL_NAMES
        .filter(name => !readOnly || isReadOnlyTool(name))
        .map(name => ({
            name: name,
            title: titleOf(name),
            description: descriptionOf(name),
            inputSchema: inputSchemaOf(name),
            annotations: annotationsOf(name)
        }));
}

function titleOf(name: RemoteToolName): string {
    return name === UPDATE_SCRIPT_SOURCE_TOOL ? UPDATE_SCRIPT_SOURCE_TITLE : TOOL_TITLES[name as ToolName];
}

function descriptionOf(name: RemoteToolName): string {
    return name === UPDATE_SCRIPT_SOURCE_TOOL ? UPDATE_SCRIPT_SOURCE_DESCRIPTION : TOOL_DESCRIPTIONS[name as ToolName];
}

function inputSchemaOf(name: RemoteToolName): Tool["inputSchema"] {
    const schema = name === UPDATE_SCRIPT_SOURCE_TOOL
        ? REMOTE_TOOL_SCHEMAS[UPDATE_SCRIPT_SOURCE_TOOL]
        : TOOL_SCHEMAS[name];

    // The shared schemas are `as const`, so their arrays are readonly; the protocol type wants
    // mutable arrays.
    return { ...schema, required: [...schema.required] };
}

/**
 * The protocol defaults are risky (`destructiveHint` defaults to true), so every value is set
 * explicitly. The read-only filter uses the same `readOnlyHint`, so list and hints cannot disagree.
 */
function annotationsOf(name: RemoteToolName): ToolAnnotations {
    if (isReadOnlyTool(name)) {
        return { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
    }

    if (IDEMPOTENT_WRITE_TOOLS.includes(name)) {
        return { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    }

    if (NON_DESTRUCTIVE_CREATE_TOOLS.includes(name)) {
        return { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
    }

    return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
}
