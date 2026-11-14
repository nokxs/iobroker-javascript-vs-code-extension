import { ensureConnected } from "./connection";
import { toFailure } from "./helpers";
import { lookupStates } from "./stateAndObjectLookup";
import { GetStatesDto, GetStatesInput, ToolDeps, ToolOutcome } from "./types";

/** Reads the current value of several ioBroker states in one call. */
export async function getStates(deps: ToolDeps, input: GetStatesInput): Promise<ToolOutcome<GetStatesDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return await lookupStates(deps.states, input);
    } catch (error) {
        return toFailure(error);
    }
}
