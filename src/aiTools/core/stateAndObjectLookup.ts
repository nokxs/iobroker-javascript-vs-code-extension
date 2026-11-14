import { IObjectWithId } from "../../models/IObject";
import { IState } from "../../models/IState";
import { IStateAndObjectRemoteService } from "../../services/stateRemote/IStateAndObjectRemoteService";
import {
    DEFAULT_OBJECT_LIMIT,
    failure,
    GetObjectsDto,
    GetObjectsInput,
    GetStateDto,
    GetStatesDto,
    GetStatesInput,
    MAX_OBJECT_LIMIT,
    MAX_OBJECT_VALUES,
    MAX_STATE_IDS,
    OBJECT_TYPE_FILTERS,
    ObjectSummaryDto,
    ObjectTypeFilter,
    success,
    ToolOutcome
} from "./types";
import { toBoundedInteger } from "./validation";

/**
 * The part of the state service both tool families need. The extension and the MCP server pass
 * their own deps into the thin `getStates`/`getObjects` wrappers, the validation and the shaping
 * live here so the two cannot drift apart.
 */
export type StateAndObjectReader = Pick<IStateAndObjectRemoteService, "getState" | "getObjectsOfType">;

const OBJECT_TYPES_OF_ALL: readonly string[] = ["state", "channel", "device", "folder"];
const STATE_TYPE = "state";

export async function lookupStates(states: StateAndObjectReader, input: GetStatesInput): Promise<ToolOutcome<GetStatesDto>> {
    const ids = normalizeStateIds(input?.stateIds);
    if (!Array.isArray(ids)) {
        return ids;
    }

    if (ids.length > MAX_STATE_IDS) {
        return failure(
            "invalid_input",
            `'stateIds' must not contain more than ${MAX_STATE_IDS} ids, but ${ids.length} were given.`,
            `Split the ids into calls of at most ${MAX_STATE_IDS} ids.`
        );
    }

    const found: GetStateDto[] = [];
    const missing: string[] = [];

    // Sequential on purpose: a call stays fast enough on a local socket and does not flood ioBroker
    // with 50 parallel requests.
    for (const id of ids) {
        const state = await states.getState(id);
        if (!state) {
            missing.push(id);
            continue;
        }

        found.push(toStateDto(id, state));
    }

    return success({ states: found, missing: missing });
}

export async function lookupObjects(states: StateAndObjectReader, input: GetObjectsInput): Promise<ToolOutcome<GetObjectsDto>> {
    const parentId = normalizeParentId(input?.parentId);
    if (parentId === undefined) {
        return failure("invalid_input", "'parentId' must be an ioBroker id without whitespace.", "Use an id like '0_userdata.0' or 'alias.0'.");
    }

    const type = normalizeType(input?.type);
    if (!type) {
        return failure(
            "invalid_input",
            `'type' must be one of ${OBJECT_TYPE_FILTERS.join(", ")}.`,
            "Use 'state' for values, or 'all' to see the structure below the parent id."
        );
    }

    const role = typeof input?.role === "string" ? input.role.trim().toLowerCase() : "";
    const search = typeof input?.search === "string" ? input.search.trim().toLowerCase() : "";

    if (parentId.length === 0 && role.length === 0 && search.length === 0) {
        return failure(
            "invalid_input",
            "Browsing without 'parentId' needs 'role' or 'search'.",
            "Pass a parent id such as '0_userdata.0', or a role such as 'value.temperature' to filter."
        );
    }

    const limit = toBoundedInteger(input?.limit, DEFAULT_OBJECT_LIMIT, 1, MAX_OBJECT_LIMIT);
    const types = type === "all" ? OBJECT_TYPES_OF_ALL : [type];

    const groups = await Promise.all(types.map(objectType => states.getObjectsOfType(objectType, parentId)));
    const matching = groups
        .reduce((all, group) => all.concat(group), [] as IObjectWithId[])
        .filter(object => matchesObject(object, search, role))
        .sort((left, right) => left._id.localeCompare(right._id))
        .map(toObjectSummary);

    const objects = matching.slice(0, limit);

    let valuesTruncated = false;
    if (input?.withValues === true) {
        valuesTruncated = await attachValues(states, objects);
    }

    return success({
        parentId: parentId.length > 0 ? parentId : null,
        objects: objects,
        truncated: matching.length > objects.length,
        valuesTruncated: valuesTruncated
    });
}

/** Answers `ToolOutcome<never>` when the input is unusable, otherwise the de-duplicated ids. */
function normalizeStateIds(raw: unknown): string[] | ToolOutcome<never> {
    if (!Array.isArray(raw) || raw.length === 0) {
        return failure(
            "invalid_input",
            "'stateIds' must be a non empty array of ioBroker state ids.",
            "Pass ids like ['0_userdata.0.temperature', 'javascript.0.myState']."
        );
    }

    const ids: string[] = [];
    for (const entry of raw) {
        const id = typeof entry === "string" ? entry.trim() : "";
        if (id.length === 0 || /\s/.test(id)) {
            return failure(
                "invalid_input",
                `'stateIds' contains an invalid id: ${JSON.stringify(entry)}.`,
                "Every entry must be a non empty ioBroker state id without whitespace."
            );
        }

        if (!ids.includes(id)) {
            ids.push(id);
        }
    }

    return ids;
}

function normalizeParentId(raw: unknown): string | undefined {
    if (raw === undefined || raw === null || raw === "") {
        return "";
    }

    if (typeof raw !== "string") {
        return undefined;
    }

    const parentId = raw.trim().replace(/\.+$/, "");
    return /\s/.test(parentId) ? undefined : parentId;
}

function normalizeType(raw: unknown): ObjectTypeFilter | undefined {
    if (raw === undefined || raw === null || raw === "") {
        return "all";
    }

    if (typeof raw !== "string") {
        return undefined;
    }

    const type = raw.trim().toLowerCase();
    return (OBJECT_TYPE_FILTERS as readonly string[]).includes(type) ? type as ObjectTypeFilter : undefined;
}

function matchesObject(object: IObjectWithId, search: string, role: string): boolean {
    if (role.length > 0 && objectRole(object).toLowerCase() !== role) {
        return false;
    }

    if (search.length === 0) {
        return true;
    }

    return object._id.toLowerCase().includes(search) || objectName(object).toLowerCase().includes(search);
}

function toStateDto(id: string, state: IState): GetStateDto {
    return {
        id: id,
        value: state.val,
        acknowledged: state.ack,
        timestamp: state.ts,
        lastChanged: state.lc,
        from: state.from
    };
}

function toObjectSummary(object: IObjectWithId): ObjectSummaryDto {
    const summary: ObjectSummaryDto = {
        id: object._id,
        name: objectName(object),
        type: object.type ?? STATE_TYPE
    };

    const role = objectRole(object);
    if (role.length > 0) {
        summary.role = role;
    }

    const unit = object.common?.unit;
    if (typeof unit === "string" && unit.length > 0) {
        summary.unit = unit;
    }

    return summary;
}

/**
 * Reads the value of every listed state, up to `MAX_OBJECT_VALUES`. Answers whether values were
 * left unread, so a caller knows the list is longer than the values.
 */
async function attachValues(states: StateAndObjectReader, objects: ObjectSummaryDto[]): Promise<boolean> {
    const stateObjects = objects.filter(object => object.type === STATE_TYPE);
    const readable = stateObjects.slice(0, MAX_OBJECT_VALUES);

    for (const object of readable) {
        const state = await states.getState(object.id);
        if (!state) {
            continue;
        }

        object.value = state.val;
        object.acknowledged = state.ack;
        object.timestamp = state.ts;
    }

    return stateObjects.length > readable.length;
}

/** ioBroker allows a plain name or per-language names; prefer German, then English, then the first. */
function objectName(object: IObjectWithId): string {
    const name = object.common?.name;
    if (typeof name === "string" && name.length > 0) {
        return name;
    }

    if (name && typeof name === "object") {
        const localized = name as { [language: string]: string };
        const languages = Object.keys(localized);
        const preferred = languages.includes("de") ? "de" : languages.includes("en") ? "en" : languages[0];
        const value = preferred ? localized[preferred] : undefined;
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
    }

    return object._id;
}

function objectRole(object: IObjectWithId): string {
    const role = object.common?.role;
    return typeof role === "string" ? role : "";
}
