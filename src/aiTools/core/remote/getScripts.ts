import { allDirectories, ensureRemoteConnected, toDirectoryDto, toScriptSummary } from "./helpers";
import {
    DEFAULT_SCRIPT_LIMIT,
    GetScriptsDto,
    GetScriptsInput,
    MAX_SCRIPT_LIMIT,
    RemoteToolDeps,
    success,
    ToolOutcome
} from "./types";
import { toBoundedInteger } from "../validation";

/** Lists the directories and scripts that the ioBroker server knows. */
export async function getScripts(deps: RemoteToolDeps, input: GetScriptsInput): Promise<ToolOutcome<GetScriptsDto>> {
    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    if (deps.scripts.getAllScripts().length === 0) {
        try {
            await deps.scripts.updateFromServer();
        } catch {
            // The list is answered from the cache. An empty list is a valid answer.
        }
    }

    const prefix = typeof input.pathPrefix === "string" ? input.pathPrefix.trim().toLowerCase() : "";
    const limit = toBoundedInteger(input.limit, DEFAULT_SCRIPT_LIMIT, 1, MAX_SCRIPT_LIMIT);

    const directories = allDirectories(deps)
        .filter(directory => matchesPrefix(`${directory._id}`, prefix))
        .map(toDirectoryDto);

    const matchingScripts = deps.scripts.getAllScripts()
        .filter(script => matchesPrefix(`${script._id}`, prefix));

    const scripts = matchingScripts.slice(0, limit).map(toScriptSummary);

    return success({
        directories: directories,
        scripts: scripts,
        truncated: matchingScripts.length > scripts.length
    });
}

function matchesPrefix(id: string, prefix: string): boolean {
    return prefix.length === 0 || id.toLowerCase().startsWith(prefix);
}
