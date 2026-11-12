import type { IJsInstanceService } from "../../../services/jsInstanceService/IJsInstanceService";
import type { IDirectoryService } from "../../../services/directory/IDirectoryService";
import type { RemoteLogService } from "../../../services/remote/RemoteLogService";
import type { RemoteScriptRepository } from "../../../services/remote/RemoteScriptRepository";
import type { IScriptRemoteService } from "../../../services/scriptRemote/IScriptRemoteService";
import type { IStateAndObjectRemoteService } from "../../../services/stateRemote/IStateAndObjectRemoteService";
import type { ConnectionState } from "../connection";

export type { ToolOutcome, ToolError, ToolErrorCode } from "../types";

/** Inputs are identical to the extension, only the results lost their local file fields. */
export type {
    CreateDirectoryInput,
    CreateScriptInput,
    DeleteDirectoryInput,
    DeleteScriptInput,
    GetJsInstancesInput,
    GetLogsInput,
    GetScriptContentInput,
    GetScriptsInput,
    GetStateInput,
    LogLevel,
    MoveScriptInput,
    RenameScriptInput,
    ScriptLanguage,
    StartStopScriptInput
} from "../types";

export {
    DEFAULT_LOG_LIMIT,
    DEFAULT_SCRIPT_LIMIT,
    failure,
    MAX_LOG_LIMIT,
    MAX_LOG_RESPONSE_CHARACTERS,
    MAX_SCRIPT_CONTENT_LENGTH,
    MAX_SCRIPT_LIMIT,
    success
} from "../types";

/** The 1 MB cap of `iobroker_update_script_source` from section 10.5 of the design. */
export const MAX_SCRIPT_SOURCE_LENGTH = 1024 * 1024;

/**
 * Everything the remote core needs. No `files`, `documents`, local repository or sync methods:
 * the four local/remote difference tools do not exist in the MCP server.
 */
export interface RemoteToolDeps {
    connection: ConnectionState
    scripts: RemoteScriptRepository
    scriptRemote: Pick<IScriptRemoteService,
        "downloadScriptWithId" |
        "uploadScript" |
        "update" |
        "startScript" |
        "stopScript" |
        "rename" |
        "move" |
        "delete">
    directories: Pick<IDirectoryService, "createDirectory" | "createDirectoriesRecursively" | "deleteDirectory">
    jsInstances: Pick<IJsInstanceService, "getAvailableInstances">
    states: Pick<IStateAndObjectRemoteService, "getState">
    logs: Pick<RemoteLogService, "getHosts" | "getLogs">
}

// ---------------------------------------------------------------------------------------------
// Tool inputs
// ---------------------------------------------------------------------------------------------

export interface UpdateScriptSourceInput {
    scriptId: string
    source: string
}

// ---------------------------------------------------------------------------------------------
// Tool results
// ---------------------------------------------------------------------------------------------

export interface DirectoryDto {
    id: string
    name: string
}

export interface ScriptSummaryDto {
    scriptId: string
    name: string
    engineType: string
    enabled: boolean
}

export interface GetScriptsDto {
    directories: DirectoryDto[]
    scripts: ScriptSummaryDto[]
    truncated: boolean
}

export interface GetScriptContentDto {
    scriptId: string
    name: string
    source: string
    truncated: boolean
}

export interface JsInstanceDto {
    id: string
}

export interface GetJsInstancesDto {
    instances: JsInstanceDto[]
    currentInstanceId: string | null
}

export interface GetStateDto {
    id: string
    value: unknown
    acknowledged: boolean
    timestamp: number
    lastChanged: number
    from: string
}

export interface GetLogsDto {
    hostId: string
    hostName: string
    scannedLines: number
    entries: string[]
    truncated: boolean
}

export interface ScriptStateDto {
    scriptId: string
    enabled: boolean
}

export interface CreateScriptDto {
    scriptId: string
    name: string
    engineType: string
}

export interface RenameScriptDto {
    oldScriptId: string
    newScriptId: string
}

export interface MoveScriptDto {
    oldScriptId: string
    newScriptId: string
}

export interface DeleteScriptDto {
    scriptId: string
}

export interface CreateDirectoryDto {
    directoryId: string
    name: string
}

export interface DeleteDirectoryDto {
    directoryId: string
}

export interface UpdateScriptSourceDto {
    scriptId: string
    characters: number
}
