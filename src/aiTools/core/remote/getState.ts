import { failure, GetStateDto, GetStateInput, RemoteToolDeps, success, ToolOutcome } from "./types";
import { ensureRemoteConnected } from "./helpers";
import { toFailure } from "../helpers";

/** Reads the current value of an ioBroker state. */
export async function getState(deps: RemoteToolDeps, input: GetStateInput): Promise<ToolOutcome<GetStateDto>> {
    const stateId = typeof input.stateId === "string" ? input.stateId.trim() : "";
    if (stateId.length === 0 || /\s/.test(stateId)) {
        return failure("invalid_input", "'stateId' must be a non empty ioBroker state id without whitespace.", "Use a full id like '0_userdata.0.temperature'.");
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        const state = await deps.states.getState(stateId);
        if (!state) {
            // ioBroker answers `null` for an id that does not exist; reading `val` would throw.
            return failure("not_found", `The ioBroker state '${stateId}' does not exist.`, "Use an existing state id such as '0_userdata.0.temperature'.");
        }

        return success({
            id: stateId,
            value: state.val,
            acknowledged: state.ack,
            timestamp: state.ts,
            lastChanged: state.lc,
            from: state.from
        });
    } catch (error) {
        return toFailure(error);
    }
}
