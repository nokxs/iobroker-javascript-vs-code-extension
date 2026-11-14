import { ITool } from "../ITool";
import { ToolDeps } from "../core/types";
import {
    GetChangedScriptsTool,
    GetJsInstancesTool,
    GetLogsTool,
    GetObjectsTool,
    GetScriptContentTool,
    GetScriptsTool,
    GetStateTool,
    GetStatesTool
} from "./readTools";
import {
    CreateDirectoryTool,
    CreateScriptTool,
    DeleteDirectoryTool,
    DeleteScriptTool,
    DownloadScriptTool,
    MoveScriptTool,
    RenameScriptTool,
    StartScriptTool,
    StopScriptTool,
    UploadAllChangedScriptsTool,
    UploadScriptTool
} from "./writeTools";

/** Builds all tools of this extension. The `isEnabled` callback enforces the opt-in. */
export function createTools(deps: ToolDeps, isEnabled: () => boolean, refreshTree: () => void): ITool<never>[] {
    const tools: ITool<never>[] = [
        new GetScriptsTool(deps, isEnabled, refreshTree),
        new GetScriptContentTool(deps, isEnabled, refreshTree),
        new GetChangedScriptsTool(deps, isEnabled, refreshTree),
        new GetJsInstancesTool(deps, isEnabled, refreshTree),
        new GetStateTool(deps, isEnabled, refreshTree),
        new GetStatesTool(deps, isEnabled, refreshTree),
        new GetObjectsTool(deps, isEnabled, refreshTree),
        new GetLogsTool(deps, isEnabled, refreshTree),
        new UploadScriptTool(deps, isEnabled, refreshTree),
        new UploadAllChangedScriptsTool(deps, isEnabled, refreshTree),
        new DownloadScriptTool(deps, isEnabled, refreshTree),
        new StartScriptTool(deps, isEnabled, refreshTree),
        new StopScriptTool(deps, isEnabled, refreshTree),
        new CreateScriptTool(deps, isEnabled, refreshTree),
        new CreateDirectoryTool(deps, isEnabled, refreshTree),
        new RenameScriptTool(deps, isEnabled, refreshTree),
        new MoveScriptTool(deps, isEnabled, refreshTree),
        new DeleteScriptTool(deps, isEnabled, refreshTree),
        new DeleteDirectoryTool(deps, isEnabled, refreshTree)
    ];

    return tools;
}
