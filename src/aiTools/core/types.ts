/* eslint-disable @typescript-eslint/naming-convention */
import type { IIobrokerConnectionService } from "../../services/iobrokerConnection/IIobrokerConnectionService";
import type { IJsInstanceService } from "../../services/jsInstanceService/IJsInstanceService";
import type { IScriptCreationService } from "../../services/scriptCreation/IScriptCreationService";
import type { IScriptFileService } from "../../services/scriptFile/IScriptFileService";
import type { IScriptIdService } from "../../services/scriptId/IScriptIdService";
import type { IScriptRemoteService } from "../../services/scriptRemote/IScriptRemoteService";
import type { IScriptRepositoryService } from "../../services/scriptRepository/IScriptRepositoryService";
import type { IScriptService } from "../../services/script/IScriptService";
import type { IStateAndObjectRemoteService } from "../../services/stateRemote/IStateAndObjectRemoteService";
import type { IDirectoryService } from "../../services/directory/IDirectoryService";
import type { LogSource } from "./logs";

export const MAX_SCRIPT_CONTENT_LENGTH = 50000;
export const DEFAULT_SCRIPT_LIMIT = 200;
export const MAX_SCRIPT_LIMIT = 500;
export const DEFAULT_LOG_LIMIT = 100;
export const MAX_LOG_LIMIT = 500;
export const MAX_LOG_RESPONSE_CHARACTERS = 30000;

export type ToolErrorCode =
    "invalid_input" |
    "already_exists" |
    "not_found" |
    "ambiguous" |
    "not_connected" |
    "unsaved_changes" |
    "server_error";

export interface ToolError {
    /** Stable machine readable reason. */
    code: ToolErrorCode
    /** What went wrong, phrased for a language model. */
    message: string
    /** What the language model should do instead. */
    hint?: string
}

export type ToolOutcome<T> =
    { ok: true, data: T } |
    { ok: false, error: ToolError };

export function success<T>(data: T): ToolOutcome<T> {
    return { ok: true, data: data };
}

export function failure(code: ToolErrorCode, message: string, hint?: string): ToolOutcome<never> {
    return { ok: false, error: { code: code, message: message, hint: hint } };
}

/** Lets the core functions detect unpersisted editor content without depending on VS Code. */
export interface IDocumentState {
    isDirty(filePath: string): boolean
}

/**
 * Everything the core functions need. Deliberately narrow (`Pick`) so that the functions can be
 * tested with small fakes and so that a later MCP adapter can provide the same shape.
 */
export interface ToolDeps {
    connection: Pick<IIobrokerConnectionService, "isConnected">
    scripts: Pick<IScriptRepositoryService,
        "getAllScripts" |
        "getAllDirectories" |
        "getRootDirectory" |
        "getScriptFromId" |
        "getAllChangedScripts" |
        "getScriptWithLocalContent" |
        "updateFromServer" |
        "updateSingleScriptOrDirectoryFromServer" |
        "evaluateDirtyState" |
        "evaluateDirtyStateForAllScripts" |
        "evaluateScriptOnRemote" |
        "evaluateScriptOnRemoteForAllScripts">
    scriptRemote: Pick<IScriptRemoteService,
        "uploadScript" |
        "downloadScriptWithId" |
        "startScript" |
        "stopScript" |
        "rename" |
        "move" |
        "delete">
    script: Pick<IScriptService, "getFileContentOnDisk" | "getDefaultScript" | "getFileExtension">
    scriptCreation: Pick<IScriptCreationService, "createFileWithName">
    scriptId: Pick<IScriptIdService, "sanatizeId">
    directories: Pick<IDirectoryService, "downloadDirectory" | "createDirectory" | "createDirectoriesRecursively" | "deleteDirectory">
    files: Pick<IScriptFileService, "exists" | "write" | "writeContent" | "rename" | "move" | "delete" | "getFileUri" | "getDirectoryUri" | "directoryExists" | "isEmptyDirectory" | "createDirectory" | "deleteDirectory">
    jsInstances: Pick<IJsInstanceService, "getAvailableInstances">
    states: Pick<IStateAndObjectRemoteService, "getState">
    logs: LogSource
    documents: IDocumentState
}

// ---------------------------------------------------------------------------------------------
// Tool inputs
// ---------------------------------------------------------------------------------------------

export type ScriptLanguage = "javascript" | "typescript";

export interface GetScriptsInput {
    pathPrefix?: string
    limit?: number
}

export interface GetScriptContentInput {
    scriptId: string
    maxLength?: number
}

export interface GetChangedScriptsInput {
    refresh?: boolean
}

export interface GetJsInstancesInput {
    scriptId?: string
}

export interface GetStateInput {
    stateId: string
}

export type LogLevel = "silly" | "debug" | "info" | "warn" | "error";

export interface GetLogsInput {
    hostId?: string
    lines?: number
    level?: LogLevel
    source?: string
    search?: string
}

export interface LogHost {
    id: string
    name: string
}

export interface UploadScriptInput {
    scriptId: string
}

export type UploadAllChangedScriptsInput = Record<string, never>;

export interface DownloadScriptInput {
    scriptId: string
}

export interface StartStopScriptInput {
    scriptId: string
}

export interface CreateScriptInput {
    directoryId?: string
    fileName: string
    language: ScriptLanguage
    source?: string
}

export interface RenameScriptInput {
    scriptId: string
    newName: string
}

export interface MoveScriptInput {
    scriptId: string
    targetDirectoryId: string
}

export interface DeleteScriptInput {
    scriptId: string
}

export interface CreateDirectoryInput {
    directoryId: string
    name?: string
}

export interface DeleteDirectoryInput {
    directoryId: string
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
    filePath: string
    engineType: string
    enabled: boolean
    isDirty: boolean
    isRemoteOnly: boolean
}

export interface GetScriptsDto {
    directories: DirectoryDto[]
    scripts: ScriptSummaryDto[]
    truncated: boolean
}

export interface GetScriptContentDto {
    scriptId: string
    name: string
    filePath: string
    source: string
    fromDisk: boolean
    truncated: boolean
}

export interface ChangedScriptDto {
    scriptId: string
    name: string
    filePath: string
}

export interface GetChangedScriptsDto {
    scripts: ChangedScriptDto[]
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

export interface ChangedScriptResult {
    scriptId: string
    success: boolean
    reason?: string
}

export interface UploadScriptsDto {
    uploaded: string[]
    failed: ChangedScriptResult[]
}

export interface DownloadScriptDto {
    scriptId: string
    filePath: string
    characters: number
}

export interface ScriptStateDto {
    scriptId: string
    enabled: boolean
}

export interface CreateScriptDto {
    scriptId: string
    name: string
    filePath: string
    engineType: string
}

export interface RenameScriptDto {
    oldScriptId: string
    newScriptId: string
    filePath: string
}

export interface MoveScriptDto {
    oldScriptId: string
    newScriptId: string
    filePath: string
}

export interface DeleteScriptDto {
    scriptId: string
    deletedFilePath: string | null
}

export interface CreateDirectoryDto {
    directoryId: string
    name: string
    path: string
}

export interface DeleteDirectoryDto {
    directoryId: string
    deletedFolderPath: string | null
}
