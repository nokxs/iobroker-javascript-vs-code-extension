import { ensureRemoteConnected } from "./helpers";
import { lookupStates } from "../stateAndObjectLookup";
import { toFailure } from "../helpers";
import { GetStatesDto, GetStatesInput, RemoteToolDeps, ToolOutcome } from "./types";

/** Reads the current value of several ioBroker states in one call. */
export async function getStates(deps: RemoteToolDeps, input: GetStatesInput): Promise<ToolOutcome<GetStatesDto>> {
    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return await lookupStates(deps.states, input);
    } catch (error) {
        return toFailure(error);
    }
}
