/* eslint-disable @typescript-eslint/naming-convention */
import type { Tool, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DESCRIPTIONS, TOOL_SCHEMAS, TOOL_TITLES } from "../../aiTools/schemas";
import type { ToolName } from "../../aiTools/schemas";
import type { ToolOutcome } from "../../aiTools/core/remote/types";
import type { RemoteToolDeps } from "../../aiTools/core/remote/types";
import { getJsInstances } from "../../aiTools/core/remote/getJsInstances";
import { getLogs } from "../../aiTools/core/remote/getLogs";
import { getObjects } from "../../aiTools/core/remote/getObjects";
import { getScriptContent } from "../../aiTools/core/remote/getScriptContent";
import { getScripts } from "../../aiTools/core/remote/getScripts";
import { getState } from "../../aiTools/core/remote/getState";
import { getStates } from "../../aiTools/core/remote/getStates";
import { getWritableStates } from "../../aiTools/core/remote/getWritableStates";
import { createDirectory } from "../../aiTools/core/remote/createDirectory";
import { createScript } from "../../aiTools/core/remote/createScript";
import { deleteDirectory } from "../../aiTools/core/remote/deleteDirectory";
import { deleteScript } from "../../aiTools/core/remote/deleteScript";
import { moveScript } from "../../aiTools/core/remote/moveScript";
import { renameScript } from "../../aiTools/core/remote/renameScript";
import { setStates } from "../../aiTools/core/remote/setStates";
import { startScript, stopScript } from "../../aiTools/core/remote/startStopScript";
import { updateScriptSource } from "../../aiTools/core/remote/updateScriptSource";
import type {
    CreateDirectoryInput,
    CreateScriptInput,
    DeleteDirectoryInput,
    DeleteScriptInput,
    GetJsInstancesInput,
    GetLogsInput,
    GetObjectsInput,
    GetScriptContentInput,
    GetScriptsInput,
    GetStateInput,
    GetStatesInput,
    GetWritableStatesInput,
    MoveScriptInput,
    RenameScriptInput,
    SetStatesInput,
    StartStopScriptInput,
    UpdateScriptSourceInput
} from "../../aiTools/core/remote/types";

/** The new tool that replaces the upload semantics of the extension. */
export const UPDATE_SCRIPT_SOURCE_TOOL = "iobroker_update_script_source";
/** Read-only discovery of the writable-state allowlist. */
export const GET_WRITABLE_STATES_TOOL = "iobroker_get_writable_states";
/** The batched write of state values, advertised only when the allowlist is not empty. */
export const SET_STATES_TOOL = "iobroker_set_states";

/**
 * Exactly the tools the MCP server implements. Deliberately not `TOOL_NAMES`: that list has the
 * four sync tools, which have no remote counterpart, and lacks the remote-only tools.
 */
export const REMOTE_TOOL_NAMES = [
    "iobroker_get_scripts",
    "iobroker_get_script_content",
    "iobroker_get_js_instances",
    "iobroker_get_state",
    "iobroker_get_states",
    "iobroker_get_objects",
    GET_WRITABLE_STATES_TOOL,
    "iobroker_get_logs",
    "iobroker_start_script",
    "iobroker_stop_script",
    "iobroker_create_script",
    "iobroker_create_directory",
    "iobroker_rename_script",
    "iobroker_move_script",
    "iobroker_delete_script",
    "iobroker_delete_directory",
    SET_STATES_TOOL,
    UPDATE_SCRIPT_SOURCE_TOOL
] as const;

export type RemoteToolName = typeof REMOTE_TOOL_NAMES[number];

/** Tools whose schema and metadata live here because they are not contributed to package.json. */
const REMOTE_ONLY_TOOL_NAMES = [
    UPDATE_SCRIPT_SOURCE_TOOL,
    GET_WRITABLE_STATES_TOOL,
    SET_STATES_TOOL
] as const;

type RemoteOnlyToolName = typeof REMOTE_ONLY_TOOL_NAMES[number];

/** The input schemas of the remote-only tools. */
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
    },
    [GET_WRITABLE_STATES_TOOL]: {
        type: "object",
        properties: {
            search: {
                type: "string",
                description: "Optional case-insensitive substring that the state id or name has to contain, e.g. 'temperatur'."
            },
            limit: {
                type: "number",
                description: "Maximum number of writable states to return (1-500, default 100). The result is marked as truncated when more match."
            }
        },
        required: [],
        additionalProperties: false
    },
    [SET_STATES_TOOL]: {
        type: "object",
        properties: {
            states: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        stateId: {
                            type: "string",
                            description: "Full ioBroker state id that matches the server allowlist, e.g. '0_userdata.0.temperature'."
                        },
                        value: {
                            description: "The new value: a string, a number, a boolean or null."
                        },
                        ack: {
                            type: "boolean",
                            description: "Acknowledgement flag of the new value. Default false."
                        }
                    },
                    required: ["stateId", "value"],
                    additionalProperties: false
                },
                description: "One to 50 state writes. The call writes nothing when any id is outside the allowlist."
            }
        },
        required: ["states"],
        additionalProperties: false
    }
} as const;

const REMOTE_ONLY_TOOL_TITLES: Record<RemoteOnlyToolName, string> = {
    [UPDATE_SCRIPT_SOURCE_TOOL]: "Update ioBroker script source",
    [GET_WRITABLE_STATES_TOOL]: "Get writable ioBroker states",
    [SET_STATES_TOOL]: "Set ioBroker states"
};

const UPDATE_SCRIPT_SOURCE_DESCRIPTION =
    "Replaces the source code of an existing script on the ioBroker server. Use iobroker_get_script_content " +
    "before editing so the rest of the script is preserved, and send the complete new source. Returns the " +
    "script id and the number of written characters. This cannot be undone; confirm the exact script id with " +
    "the user before using this tool.";

const GET_WRITABLE_STATES_DESCRIPTION =
    "Lists the state ids this server is allowed to write, based on the server's IOBROKER_MCP_WRITABLE_STATES " +
    "allowlist. Returns the configured glob patterns and up to limit existing matching state objects with id, " +
    "name, role, unit and a writable flag. Use it before iobroker_set_states; an empty list means this server " +
    "cannot write any state. Read-only and requires an active ioBroker connection when patterns are configured.";

const SET_STATES_DESCRIPTION =
    "Sets the values of one to 50 existing ioBroker states in one call. Every id must match the server's " +
    "IOBROKER_MCP_WRITABLE_STATES allowlist; when one id is not allowed the call writes nothing. Returns the " +
    "written, failed and notAttempted entries, including whether reading the value back confirmed the write. " +
    "The acknowledgement flag defaults to false. Check the ids with iobroker_get_writable_states first and " +
    "confirm the overwrite with the user. Requires an active ioBroker connection.";

/**
 * The extension descriptions talk about the local file, the dirty state and `fromDisk`. None of that
 * exists in the server, and a model would look for fields that are not there, so the tools that
 * differ get their own text.
 */
const REMOTE_TOOL_DESCRIPTIONS: Partial<Record<RemoteToolName, string>> = {
    iobroker_get_scripts:
        "Lists the ioBroker.javascript directories and scripts on the ioBroker server. Returns directory ids " +
        "(use them as directoryId for creating or moving scripts) and script ids (use them as scriptId for all " +
        "other tools) together with the engine type and the enabled state. Use it before any tool that needs a " +
        "script or directory id. Does not read the script source code, use iobroker_get_script_content for that.",
    iobroker_get_script_content:
        "Returns the source code of one ioBroker script as stored on the ioBroker server. The result is marked " +
        "as truncated when it exceeds maxLength. Only works for script ids, not for directories.",
    iobroker_create_script:
        "Creates a new script on the ioBroker server. The source is written to the ioBroker object. Fails when " +
        "the id already exists in the directory. Pass a directoryId to place the script in a subdirectory; omit " +
        "it to use the root directory.",
    iobroker_create_directory:
        "Creates a directory on the ioBroker server. Pass the full directory id to create missing intermediate " +
        "directories in one step, or an existing parent id together with a name. Fails when the directory " +
        "already exists.",
    iobroker_rename_script:
        "Renames a script on the ioBroker server. The directory does not change; use iobroker_move_script for " +
        "that. Returns the old and the new script id.",
    iobroker_move_script:
        "Moves a script into another directory on the ioBroker server. The directory has to exist already. " +
        "Returns the old and the new script id.",
    iobroker_delete_script:
        "Deletes a script on the ioBroker server. This cannot be undone. Confirm the exact script id with the " +
        "user before using this tool.",
    iobroker_delete_directory:
        "Deletes an empty directory on the ioBroker server. The directory has to be empty: move or delete its " +
        "scripts and subdirectories first. This cannot be undone; the root directory, 'script.js.common' and " +
        "'script.js.global' cannot be deleted. Confirm the exact directory id with the user before using this tool.",
    [UPDATE_SCRIPT_SOURCE_TOOL]: UPDATE_SCRIPT_SOURCE_DESCRIPTION,
    [GET_WRITABLE_STATES_TOOL]: GET_WRITABLE_STATES_DESCRIPTION,
    [SET_STATES_TOOL]: SET_STATES_DESCRIPTION
};

type RemoteToolHandler = (deps: RemoteToolDeps, input: Record<string, unknown>) => Promise<ToolOutcome<unknown>>;

const READ_ONLY_TOOLS: readonly RemoteToolName[] = [
    "iobroker_get_scripts",
    "iobroker_get_script_content",
    "iobroker_get_js_instances",
    "iobroker_get_state",
    "iobroker_get_states",
    "iobroker_get_objects",
    GET_WRITABLE_STATES_TOOL,
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
    iobroker_get_states: (deps, input) => getStates(deps, input as unknown as GetStatesInput),
    iobroker_get_objects: (deps, input) => getObjects(deps, input as unknown as GetObjectsInput),
    [GET_WRITABLE_STATES_TOOL]: (deps, input) => getWritableStates(deps, input as unknown as GetWritableStatesInput),
    iobroker_get_logs: (deps, input) => getLogs(deps, input as unknown as GetLogsInput),
    iobroker_start_script: (deps, input) => startScript(deps, input as unknown as StartStopScriptInput),
    iobroker_stop_script: (deps, input) => stopScript(deps, input as unknown as StartStopScriptInput),
    iobroker_create_script: (deps, input) => createScript(deps, input as unknown as CreateScriptInput),
    iobroker_create_directory: (deps, input) => createDirectory(deps, input as unknown as CreateDirectoryInput),
    iobroker_rename_script: (deps, input) => renameScript(deps, input as unknown as RenameScriptInput),
    iobroker_move_script: (deps, input) => moveScript(deps, input as unknown as MoveScriptInput),
    iobroker_delete_script: (deps, input) => deleteScript(deps, input as unknown as DeleteScriptInput),
    iobroker_delete_directory: (deps, input) => deleteDirectory(deps, input as unknown as DeleteDirectoryInput),
    [SET_STATES_TOOL]: (deps, input) => setStates(deps, input as unknown as SetStatesInput),
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

/**
 * The static `tools/list` answer, filtered by the read-only switch and by the presence of an
 * allowlist. Pure, no IO. `iobroker_get_writable_states` stays visible without an allowlist, so a
 * model can learn that nothing is writable; `iobroker_set_states` is not advertised at all.
 */
export function listRemoteTools(readOnly: boolean, writableStatesEnabled = false): Tool[] {
    return REMOTE_TOOL_NAMES
        .filter(name => !readOnly || isReadOnlyTool(name))
        .filter(name => name !== SET_STATES_TOOL || writableStatesEnabled)
        .map(name => ({
            name: name,
            title: titleOf(name),
            description: descriptionOf(name),
            inputSchema: inputSchemaOf(name),
            annotations: annotationsOf(name)
        }));
}

function isRemoteOnlyTool(name: RemoteToolName): name is RemoteOnlyToolName {
    return (REMOTE_ONLY_TOOL_NAMES as readonly string[]).includes(name);
}

function titleOf(name: RemoteToolName): string {
    return isRemoteOnlyTool(name) ? REMOTE_ONLY_TOOL_TITLES[name] : TOOL_TITLES[name as ToolName];
}

function descriptionOf(name: RemoteToolName): string {
    const description = (REMOTE_TOOL_DESCRIPTIONS as Record<string, string | undefined>)[name];
    return description ?? TOOL_DESCRIPTIONS[name as ToolName];
}

function inputSchemaOf(name: RemoteToolName): Tool["inputSchema"] {
    const schema = isRemoteOnlyTool(name)
        ? REMOTE_TOOL_SCHEMAS[name]
        : TOOL_SCHEMAS[name as ToolName];

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

    if (name === SET_STATES_TOOL) {
        // Writing the same value twice leaves the same state, but overwriting a value is a
        // destructive update of the installation.
        return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
    }

    if (NON_DESTRUCTIVE_CREATE_TOOLS.includes(name)) {
        return { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
    }

    return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
}
