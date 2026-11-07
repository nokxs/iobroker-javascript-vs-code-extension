import { BaseTool } from "./BaseTool";
import { getChangedScripts } from "../core/getChangedScripts";
import { getJsInstances } from "../core/getJsInstances";
import { getLogs } from "../core/getLogs";
import { getScriptContent } from "../core/getScriptContent";
import { getScripts } from "../core/getScripts";
import { getState } from "../core/getState";
import {
    GetChangedScriptsInput,
    GetJsInstancesInput,
    GetLogsInput,
    GetScriptContentInput,
    GetScriptsInput,
    GetStateInput,
    ToolOutcome
} from "../core/types";

export class GetScriptsTool extends BaseTool<GetScriptsInput> {
    readonly name = "iobroker_get_scripts" as const;

    protected run(input: GetScriptsInput): Promise<ToolOutcome<unknown>> {
        return getScripts(this.deps, input);
    }
}

export class GetScriptContentTool extends BaseTool<GetScriptContentInput> {
    readonly name = "iobroker_get_script_content" as const;

    protected run(input: GetScriptContentInput): Promise<ToolOutcome<unknown>> {
        return getScriptContent(this.deps, input);
    }
}

export class GetChangedScriptsTool extends BaseTool<GetChangedScriptsInput> {
    readonly name = "iobroker_get_changed_scripts" as const;

    protected run(input: GetChangedScriptsInput): Promise<ToolOutcome<unknown>> {
        return getChangedScripts(this.deps, input);
    }
}

export class GetJsInstancesTool extends BaseTool<GetJsInstancesInput> {
    readonly name = "iobroker_get_js_instances" as const;

    protected run(input: GetJsInstancesInput): Promise<ToolOutcome<unknown>> {
        return getJsInstances(this.deps, input);
    }
}

export class GetStateTool extends BaseTool<GetStateInput> {
    readonly name = "iobroker_get_state" as const;

    protected run(input: GetStateInput): Promise<ToolOutcome<unknown>> {
        return getState(this.deps, input);
    }
}

export class GetLogsTool extends BaseTool<GetLogsInput> {
    readonly name = "iobroker_get_logs" as const;

    protected run(input: GetLogsInput): Promise<ToolOutcome<unknown>> {
        return getLogs(this.deps, input);
    }
}
