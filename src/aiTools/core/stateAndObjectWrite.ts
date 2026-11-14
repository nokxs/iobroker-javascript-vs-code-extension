import type { IObject } from "../../models/IObject";
import { IoBrokerId } from "../../models/IoBrokerId";
import type { IState } from "../../models/IState";
import type { IStateAndObjectRemoteService } from "../../services/stateRemote/IStateAndObjectRemoteService";
import {
    failure,
    MAX_STATE_WRITES,
    SetStatesDto,
    StateWriteFailureDto,
    success,
    ToolOutcome,
    WrittenStateDto
} from "./types";
import { toMessage } from "./validation";

/** The part of the state service a write needs. */
export type StateWriteTarget = Pick<IStateAndObjectRemoteService, "getObject" | "setState" | "getState">;

export interface StateWriteRequest {
    stateId: string;
    value: unknown;
    ack: boolean;
}

/**
 * Validates the whole batch before anything is written. A single denied id fails the call and
 * keeps every state untouched, so an agent cannot use a valid prefix to smuggle a forbidden id
 * into the second half of a batch.
 *
 * The allowlist check lives here, in the VS Code free core, not in the MCP handler: the transport
 * cannot be the only place that enforces it.
 */
export function validateStateWrites(raw: unknown, patterns: readonly string[]): ToolOutcome<StateWriteRequest[]> {
    const input = raw as { states?: unknown } | null | undefined;
    const rawStates = input?.states;

    if (!Array.isArray(rawStates) || rawStates.length === 0) {
        return failure(
            "invalid_input",
            "'states' must be a non empty array of state writes.",
            "Pass entries like [{ \"stateId\": \"0_userdata.0.temperature\", \"value\": 21.5 }]."
        );
    }

    if (rawStates.length > MAX_STATE_WRITES) {
        return failure(
            "invalid_input",
            `'states' must not contain more than ${MAX_STATE_WRITES} entries, but ${rawStates.length} were given.`,
            `Split the writes into calls of at most ${MAX_STATE_WRITES} entries.`
        );
    }

    if (patterns.length === 0) {
        return failure(
            "not_allowed",
            "This server has no writable states configured.",
            "Set IOBROKER_MCP_WRITABLE_STATES to a semicolon separated list of glob patterns, for example '0_userdata.0.*', and restart the server."
        );
    }

    const entries: StateWriteRequest[] = [];
    const seen = new Set<string>();

    for (const rawEntry of rawStates) {
        if (rawEntry === null || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
            return failure("invalid_input", `Every entry of 'states' must be an object, but got ${JSON.stringify(rawEntry)}.`);
        }

        const entry = rawEntry as Record<string, unknown>;
        const stateId = typeof entry.stateId === "string" ? entry.stateId.trim() : "";

        if (stateId.length === 0 || !IoBrokerId.isValid(stateId)) {
            return failure(
                "invalid_input",
                `'states' contains an invalid state id: ${JSON.stringify(entry.stateId)}.`,
                "Every entry needs one full ioBroker state id without whitespace or wildcards, for example '0_userdata.0.temperature'."
            );
        }

        if (seen.has(stateId)) {
            return failure(
                "invalid_input",
                `'states' contains the state '${stateId}' more than once.`,
                "Send every state id at most once per call."
            );
        }

        if (!Object.prototype.hasOwnProperty.call(entry, "value") || entry.value === undefined) {
            return failure("invalid_input", `The entry for '${stateId}' has no 'value'.`, "Values may be a string, a number, a boolean or null.");
        }

        const value = entry.value;
        const valueType = typeof value;
        if (value !== null && valueType !== "string" && valueType !== "number" && valueType !== "boolean") {
            return failure(
                "invalid_input",
                `The value for '${stateId}' must be a string, a number, a boolean or null, but was ${valueType}.`,
                "ioBroker states store scalar values; JSON objects and arrays are not supported."
            );
        }

        if (valueType === "number" && !Number.isFinite(value as number)) {
            return failure("invalid_input", `The value for '${stateId}' must be a finite number.`);
        }

        if (entry.ack !== undefined && typeof entry.ack !== "boolean") {
            return failure("invalid_input", `'ack' for '${stateId}' must be a boolean.`);
        }

        seen.add(stateId);
        entries.push({ stateId: stateId, value: value, ack: entry.ack === true });
    }

    const denied = entries.filter(entry => !IoBrokerId.matchesAny(entry.stateId, patterns)).map(entry => entry.stateId);
    if (denied.length > 0) {
        const shown = denied.slice(0, 10).join(", ");
        const more = denied.length > 10 ? ` and ${denied.length - 10} more` : "";
        return failure(
            "not_allowed",
            `Not allowed to write ${denied.length === 1 ? "the state" : "these states"}: ${shown}${more}.`,
            `The allowlist contains: ${patterns.join("; ")}. Nothing was written.`
        );
    }

    return success(entries);
}

/**
 * Writes a validated batch sequentially. A missing or non state object is a per-entry failure and
 * the batch continues; a socket error stops it and reports the untouched rest as `notAttempted`.
 * The value is never logged.
 */
export async function executeStateWrites(states: StateWriteTarget, entries: readonly StateWriteRequest[]): Promise<SetStatesDto> {
    const written: WrittenStateDto[] = [];
    const failed: StateWriteFailureDto[] = [];

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];

        let object: IObject | null;
        try {
            object = await states.getObject(entry.stateId);
        } catch (error) {
            failed.push({ id: entry.stateId, code: "server_error", message: toMessage(error) });
            return { written: written, failed: failed, notAttempted: remainingIds(entries, index + 1) };
        }

        if (!object) {
            failed.push({
                id: entry.stateId,
                code: "not_found",
                message: `The ioBroker state '${entry.stateId}' does not exist.`,
            });
            continue;
        }

        if (object.type !== undefined && object.type !== "state") {
            failed.push({
                id: entry.stateId,
                code: "invalid_input",
                message: `The ioBroker object '${entry.stateId}' is of type '${object.type}', not a state.`,
            });
            continue;
        }

        try {
            await states.setState(entry.stateId, { val: entry.value, ack: entry.ack });
        } catch (error) {
            failed.push({ id: entry.stateId, code: "server_error", message: toMessage(error) });
            return { written: written, failed: failed, notAttempted: remainingIds(entries, index + 1) };
        }

        const result: WrittenStateDto = {
            id: entry.stateId,
            value: entry.value,
            acknowledged: entry.ack,
            verified: await isVerified(states, entry)
        };

        if (object.common?.write === false) {
            result.warning = "The object sets common.write to false; the adapter may ignore the value.";
        }

        written.push(result);
    }

    return { written: written, failed: failed, notAttempted: [] };
}

/**
 * The re-read is best effort: Admin 4 has no `getState` socket call, and a missing confirmation
 * must not turn a successful write into a reported failure.
 */
async function isVerified(states: StateWriteTarget, entry: StateWriteRequest): Promise<boolean> {
    try {
        const state: IState | null = await states.getState(entry.stateId);
        return !!state && state.val === entry.value && state.ack === entry.ack;
    } catch {
        return false;
    }
}

function remainingIds(entries: readonly StateWriteRequest[], start: number): string[] {
    return entries.slice(start).map(entry => entry.stateId);
}
