import { ensureRemoteConnected } from "./helpers";
import { toFailure } from "../helpers";
import { listWritableStates } from "../writableTargets";
import {
    GetWritableStatesDto,
    GetWritableStatesInput,
    RemoteToolDeps,
    success,
    ToolOutcome
} from "./types";

/** Lists the configured allowlist patterns and the existing states they currently match. */
export async function getWritableStates(deps: RemoteToolDeps, input: GetWritableStatesInput): Promise<ToolOutcome<GetWritableStatesDto>> {
    // Without an allowlist there is nothing to expand and no reason to touch ioBroker.
    if (deps.writableStates.length === 0) {
        return success({ patterns: [], states: [], truncated: false });
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return await listWritableStates(deps.states, deps.writableStates, input);
    } catch (error) {
        return toFailure(error);
    }
}
