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
