import { ensureRemoteConnected } from "./helpers";
import { lookupObjects } from "../stateAndObjectLookup";
import { toFailure } from "../helpers";
import { GetObjectsDto, GetObjectsInput, RemoteToolDeps, ToolOutcome } from "./types";

/** Lists the ioBroker objects below an id, optionally with the current values. */
export async function getObjects(deps: RemoteToolDeps, input: GetObjectsInput): Promise<ToolOutcome<GetObjectsDto>> {
    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return await lookupObjects(deps.states, input);
    } catch (error) {
        return toFailure(error);
    }
}
