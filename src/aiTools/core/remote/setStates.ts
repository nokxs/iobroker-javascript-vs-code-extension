import { ensureRemoteConnected } from "./helpers";
import { toFailure } from "../helpers";
import { executeStateWrites, validateStateWrites } from "../stateAndObjectWrite";
import {
    RemoteToolDeps,
    SetStatesDto,
    SetStatesInput,
    success,
    ToolOutcome
} from "./types";

/**
 * Writes up to 50 state values. Validation and the allowlist check run before the lazy connect,
 * so a malformed or forbidden batch fails as `invalid_input`/`not_allowed` even when ioBroker is
 * unreachable and writes nothing.
 */
export async function setStates(deps: RemoteToolDeps, input: SetStatesInput): Promise<ToolOutcome<SetStatesDto>> {
    const validated = validateStateWrites(input, deps.writableStates);
    if (!validated.ok) {
        return validated;
    }

    const connectionError = ensureRemoteConnected(deps);
    if (connectionError) {
        return { ok: false, error: connectionError };
    }

    try {
        return success(await executeStateWrites(deps.states, validated.data));
    } catch (error) {
        return toFailure(error);
    }
}
