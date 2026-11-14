/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Single source of truth for the input schemas of the AI tools.
 * `contributes.languageModelTools` in package.json mirrors these schemas 1:1 (guarded by a test).
 */
export const TOOL_SCHEMAS = {
    iobroker_get_scripts: {
        type: "object",
        properties: {
            pathPrefix: {
                type: "string",
                description: "Only return directories and scripts whose ioBroker id starts with this prefix, e.g. 'script.js.common.Licht'. Omit to get everything."
            },
            limit: {
                type: "number",
                description: "Maximum number of scripts to return (1-500, default 200). Directories are always returned completely."
            }
        },
        required: [],
        additionalProperties: false
    },
    iobroker_get_script_content: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id, e.g. 'script.js.common.MyScript'. Use iobroker_get_scripts to look it up."
            },
            maxLength: {
                type: "number",
                description: "Maximum number of characters to return (default 50000). The result is marked as truncated when the source is longer."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_get_changed_scripts: {
        type: "object",
        properties: {
            refresh: {
                type: "boolean",
                description: "Re-evaluate every script against the ioBroker server before answering. Slower but accurate. Default false."
            }
        },
        required: [],
        additionalProperties: false
    },
    iobroker_get_js_instances: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Optional script id. When given, the result contains the javascript instance the script runs on."
            }
        },
        required: [],
        additionalProperties: false
    },
    iobroker_get_state: {
        type: "object",
        properties: {
            stateId: {
                type: "string",
                description: "Full ioBroker state id, e.g. 'javascript.0.myState' or '0_userdata.0.temperature'."
            }
        },
        required: ["stateId"],
        additionalProperties: false
    },
    iobroker_get_states: {
        type: "object",
        properties: {
            stateIds: {
                type: "array",
                items: { type: "string" },
                description: "Full ioBroker state ids, up to 50 per call, e.g. ['0_userdata.0.temperature', 'javascript.0.myState']. Prefer this tool over iobroker_get_state as soon as you need more than one id. Ids that do not exist are returned in 'missing' instead of failing the call."
            }
        },
        required: ["stateIds"],
        additionalProperties: false
    },
    iobroker_get_objects: {
        type: "object",
        properties: {
            parentId: {
                type: "string",
                description: "ioBroker id whose subtree is browsed, e.g. '0_userdata.0' or 'alias.0.UG.Technikraum'. Omit only together with 'role' or 'search'."
            },
            type: {
                type: "string",
                enum: ["state", "channel", "device", "folder", "all"],
                description: "Object type to list. 'state' for values, 'all' (default) for the structure below the parent id."
            },
            role: {
                type: "string",
                description: "Optional exact ioBroker role filter, e.g. 'value.temperature' or 'switch'. Case-insensitive."
            },
            search: {
                type: "string",
                description: "Optional case-insensitive substring that the id or the name has to contain, e.g. 'brauchwasser'."
            },
            limit: {
                type: "number",
                description: "Maximum number of objects to return (1-500, default 100). The result is marked as truncated when more match."
            },
            withValues: {
                type: "boolean",
                description: "Also return value, acknowledged and timestamp of up to 50 listed states. Default false."
            }
        },
        required: [],
        additionalProperties: false
    },
    iobroker_get_logs: {
        type: "object",
        properties: {
            hostId: {
                type: "string",
                description: "Optional full ioBroker host id, e.g. 'system.host.myHost'. Omit only when exactly one host is configured."
            },
            lines: {
                type: "number",
                description: "Maximum number of recent log lines to read before filtering (1-500, default 100)."
            },
            level: {
                type: "string",
                enum: ["silly", "debug", "info", "warn", "error"],
                description: "Minimum severity to include. For example, 'warn' returns warnings and errors."
            },
            source: {
                type: "string",
                description: "Optional case-insensitive substring filter for the source of an entry, e.g. 'javascript.0'. The message text is not searched."
            },
            search: {
                type: "string",
                description: "Optional case-insensitive substring to find in an entry, including its continuation lines such as a stack trace. A matching entry is returned completely."
            }
        },
        required: [],
        additionalProperties: false
    },
    iobroker_upload_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script that should be uploaded from disk to the ioBroker server."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_upload_all_changed_scripts: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
    },
    iobroker_download_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script that should be downloaded from the ioBroker server to disk. Fails when the file has unsaved editor changes."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_start_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script that should be started (enabled) on the ioBroker server."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_stop_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script that should be stopped (disabled) on the ioBroker server."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_create_script: {
        type: "object",
        properties: {
            directoryId: {
                type: "string",
                description: "ioBroker id of the target directory, e.g. 'script.js.common'. Omit to create the script in the root directory. Use iobroker_get_scripts to look up available directories."
            },
            fileName: {
                type: "string",
                description: "File name without extension, e.g. 'MyScript'. Must not contain path separators."
            },
            language: {
                type: "string",
                enum: ["javascript", "typescript"],
                description: "Language of the new script."
            },
            source: {
                type: "string",
                description: "Initial source code. Written to the ioBroker server and to the local file. Defaults to an empty string."
            }
        },
        required: ["fileName", "language"],
        additionalProperties: false
    },
    iobroker_create_directory: {
        type: "object",
        properties: {
            directoryId: {
                type: "string",
                description: "ioBroker id of the new directory, e.g. 'script.js.common.NewFolder'. When 'name' is given this is the parent directory id (e.g. 'script.js.common', or 'script.js' for the root) and it has to exist already. When the full id is passed without 'name', missing intermediate directories are created as well."
            },
            name: {
                type: "string",
                description: "Optional directory name. When omitted, the last segment of 'directoryId' is used. Must not contain dots or path separators."
            }
        },
        required: ["directoryId"],
        additionalProperties: false
    },
    iobroker_rename_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script to rename."
            },
            newName: {
                type: "string",
                description: "New script name without path separators. The directory does not change."
            }
        },
        required: ["scriptId", "newName"],
        additionalProperties: false
    },
    iobroker_move_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script to move."
            },
            targetDirectoryId: {
                type: "string",
                description: "ioBroker id of the target directory, e.g. 'script.js.common'. Use iobroker_get_scripts to look up available directories."
            }
        },
        required: ["scriptId", "targetDirectoryId"],
        additionalProperties: false
    },
    iobroker_delete_script: {
        type: "object",
        properties: {
            scriptId: {
                type: "string",
                description: "Full ioBroker script id of the script that should be deleted on the ioBroker server and on disk."
            }
        },
        required: ["scriptId"],
        additionalProperties: false
    },
    iobroker_delete_directory: {
        type: "object",
        properties: {
            directoryId: {
                type: "string",
                description: "ioBroker id of the empty directory that should be deleted, e.g. 'script.js.common.OldFolder'. Use iobroker_get_scripts to look up available directories."
            }
        },
        required: ["directoryId"],
        additionalProperties: false
    }
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export const TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as ToolName[];

export function isToolName(name: string): name is ToolName {
    return Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, name);
}

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Title and description per contributed tool. The MCP server advertises both in `tools/list`;
 * the contribution test asserts that they match `contributes.languageModelTools` in package.json,
 * so the duplication cannot drift.
 */
export const TOOL_TITLES: Record<ToolName, string> = {
    iobroker_get_scripts: "Get ioBroker scripts",
    iobroker_get_script_content: "Get ioBroker script content",
    iobroker_get_changed_scripts: "Get changed ioBroker scripts",
    iobroker_get_js_instances: "Get ioBroker javascript instances",
    iobroker_get_state: "Get ioBroker state",
    iobroker_get_states: "Get ioBroker states",
    iobroker_get_objects: "Browse ioBroker objects",
    iobroker_get_logs: "Get ioBroker logs",
    iobroker_upload_script: "Upload ioBroker script",
    iobroker_upload_all_changed_scripts: "Upload all changed ioBroker scripts",
    iobroker_download_script: "Download ioBroker script",
    iobroker_start_script: "Start ioBroker script",
    iobroker_stop_script: "Stop ioBroker script",
    iobroker_create_script: "Create ioBroker script",
    iobroker_create_directory: "Create ioBroker directory",
    iobroker_rename_script: "Rename ioBroker script",
    iobroker_move_script: "Move ioBroker script",
    iobroker_delete_script: "Delete ioBroker script",
    iobroker_delete_directory: "Delete ioBroker directory",
};

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
    iobroker_get_scripts: "Lists the ioBroker.javascript directories and scripts that the extension knows about. Returns directory ids (use them as directoryId for creating or moving scripts) and script ids (use them as scriptId for all other tools) together with the local file path, engine type, enabled state and whether the script is dirty or remote only. Use it before any tool that needs a script or directory id. Does not read the script source code, use iobroker_get_script_content for that.",
    iobroker_get_script_content: "Returns the source code of one ioBroker script. The local file is preferred; when the file does not exist the source stored on the ioBroker server is returned and 'fromDisk' is false. The result is marked as truncated when it exceeds maxLength. Only works for script ids, not for directories.",
    iobroker_get_changed_scripts: "Lists the ioBroker scripts whose local file differs from the version on the ioBroker server. Set 'refresh' to true to re-evaluate every script against the server first; that requires an active connection and is slower. Use iobroker_upload_all_changed_scripts to push the changes to the server.",
    iobroker_get_js_instances: "Lists the installed javascript adapter instances of ioBroker. When a scriptId is given, the result also contains the instance the script currently runs on. Read-only and requires an active ioBroker connection.",
    iobroker_get_state: "Reads the current value of an ioBroker state, including the acknowledge flag and the timestamps. Use it to inspect what an ioBroker script produced or to debug state based logic. Requires an active ioBroker connection.",
    iobroker_get_states: "Reads the current value of up to 50 ioBroker states in one call, each with the acknowledge flag and the timestamps. Use it instead of iobroker_get_state as soon as you need more than one id. Ids that do not exist are returned in 'missing' and do not fail the call. Requires an active ioBroker connection.",
    iobroker_get_objects: "Lists the ioBroker objects below an id, so state ids can be found without reading a script: the result has id, name, type, role and unit per object, and with withValues also the value of up to 50 states. Filter by object type, role or a substring of the id or name. Browsing without a parent id needs a role or a search. Read-only and requires an active ioBroker connection.",
    iobroker_get_logs: "Reads the tail of an ioBroker host log. Requests up to 500 recent log lines (100 by default) and then filters whole entries by minimum severity, source substring and text substring, keeping continuation lines such as stack traces with their entry. Specify hostId when more than one host is configured. The response is capped at 30,000 characters. Requires an active ioBroker connection; log contents may contain sensitive information.",
    iobroker_upload_script: "Uploads the local content of one script to the ioBroker server and overwrites the server version. Unsaved editor content is not included, the file has to be saved first. Use iobroker_upload_all_changed_scripts to upload every changed script at once.",
    iobroker_upload_all_changed_scripts: "Uploads every script whose local file differs from the ioBroker server. Returns the uploaded ids and the ids that failed with a reason. Use it after editing several scripts. Unsaved editor content is not included.",
    iobroker_download_script: "Downloads one script from the ioBroker server and overwrites the local file. Fails with the code 'unsaved_changes' when the file has unsaved editor changes; the user has to save or revert it first. Use it before reading a script that might have been changed on the server.",
    iobroker_start_script: "Enables a script on the ioBroker server so the javascript adapter starts it. This does not upload anything, the server version is used. Requires an active ioBroker connection.",
    iobroker_stop_script: "Disables a script on the ioBroker server so the javascript adapter stops running it. The script itself stays on the server. Requires an active ioBroker connection.",
    iobroker_create_script: "Creates a new script on the ioBroker server and the matching local file. The same source is written to both places. Fails when a script or file with that name already exists in the directory. Pass a directoryId to place the script in a subdirectory; omit it to use the root directory.",
    iobroker_create_directory: "Creates a directory on the ioBroker server and the matching local folder. Pass the full directory id to create missing intermediate directories in one step, or an existing parent id together with a name. Fails when the directory or folder already exists.",
    iobroker_rename_script: "Renames a script on the ioBroker server and renames the local file. The directory does not change; use iobroker_move_script for that. Returns the old and the new script id.",
    iobroker_move_script: "Moves a script into another directory on the ioBroker server and moves the local file into the matching folder. The directory has to exist already. Returns the old and the new script id.",
    iobroker_delete_script: "Deletes a script on the ioBroker server and deletes the local file. This cannot be undone. Confirm the exact script id with the user before using this tool.",
    iobroker_delete_directory: "Deletes an empty directory on the ioBroker server and the matching local folder. The directory has to be empty: move or delete its scripts and subdirectories first. This cannot be undone; the root directory, 'script.js.common' and 'script.js.global' cannot be deleted. Confirm the exact directory id with the user before using this tool.",
};
