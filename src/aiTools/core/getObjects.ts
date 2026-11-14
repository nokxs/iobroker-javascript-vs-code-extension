import { ensureConnected } from "./connection";
import { toFailure } from "./helpers";
import { lookupObjects } from "./stateAndObjectLookup";
import { GetObjectsDto, GetObjectsInput, ToolDeps, ToolOutcome } from "./types";

/** Lists the ioBroker objects below an id, optionally with the current values. */
export async function getObjects(deps: ToolDeps, input: GetObjectsInput): Promise<ToolOutcome<GetObjectsDto>> {
    const connectionError = ensureConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return await lookupObjects(deps.states, input);
    } catch (error) {
        return toFailure(error);
    }
}
