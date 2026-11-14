import type { IObjectWithId } from "../../models/IObject";
import { IoBrokerId } from "../../models/IoBrokerId";
import type { IStateAndObjectRemoteService } from "../../services/stateRemote/IStateAndObjectRemoteService";
import { toObjectSummary } from "./stateAndObjectLookup";
import {
    DEFAULT_OBJECT_LIMIT,
    GetWritableStatesDto,
    GetWritableStatesInput,
    MAX_OBJECT_LIMIT,
    success,
    ToolOutcome,
    WritableStateDto
} from "./types";
import { toBoundedInteger } from "./validation";

export type WritableStateReader = Pick<IStateAndObjectRemoteService, "getObjectsOfType">;

/**
 * Expands the allowlist patterns into the existing state objects below them. The patterns are
 * pure globs and may point into a subtree that does not exist yet, so the answer is a snapshot,
 * not a guarantee: `iobroker_set_states` checks the allowlist again for every id.
 */
export async function listWritableStates(
    states: WritableStateReader,
    patterns: readonly string[],
    input: GetWritableStatesInput
): Promise<ToolOutcome<GetWritableStatesDto>> {
    if (patterns.length === 0) {
        return success({ patterns: [], states: [], truncated: false });
    }

    const search = typeof input?.search === "string" ? input.search.trim().toLowerCase() : "";
    const limit = toBoundedInteger(input?.limit, DEFAULT_OBJECT_LIMIT, 1, MAX_OBJECT_LIMIT);

    // One object view per literal prefix instead of one per pattern. A pattern without a literal
    // prefix (`*`) needs the whole state database, which is why the server warns about it.
    const prefixes = Array.from(new Set(patterns.map(pattern => IoBrokerId.parentPrefixOf(pattern))));
    const seen = new Set<string>();
    const matching: WritableStateDto[] = [];

    for (const prefix of prefixes) {
        const objects: IObjectWithId[] = await states.getObjectsOfType("state", prefix);
        for (const object of objects) {
            if (seen.has(object._id)) {
                continue;
            }

            seen.add(object._id);

            if (object.type !== undefined && object.type !== "state") {
                continue;
            }

            if (!IoBrokerId.matchesAny(object._id, patterns)) {
                continue;
            }

            const state = toWritableState(object);
            if (search.length > 0 && !state.id.toLowerCase().includes(search) && !state.name.toLowerCase().includes(search)) {
                continue;
            }

            matching.push(state);
        }
    }

    matching.sort((left, right) => left.id.localeCompare(right.id));

    return success({
        patterns: [...patterns],
        states: matching.slice(0, limit),
        truncated: matching.length > limit
    });
}

function toWritableState(object: IObjectWithId): WritableStateDto {
    const summary = toObjectSummary(object);
    return {
        id: summary.id,
        name: summary.name,
        role: summary.role,
        unit: summary.unit,
        writable: object.common?.write !== false
    };
}
