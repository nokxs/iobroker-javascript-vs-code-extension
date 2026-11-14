import { IObject, IObjectWithId } from "../../models/IObject";
import { IObjectList } from "../../models/IObjectList";
import { IState } from "../../models/IState";
import { IObjectChangedEventListener } from "./IObjectChangedEventListener";

export interface IStateAndObjectRemoteService {
    init(): void

    registerObjectChangedEventListener(listener: IObjectChangedEventListener): void

    getState(id: string): Promise<IState>;
    /** Answers `null` for an id that does not exist. */
    getObject(id: string): Promise<IObject | null>;
    setState(id: string, state: Pick<IState, "val" | "ack">): Promise<void>;
    getAllObjects(): Promise<IObjectList>;

    /**
     * Objects of one ioBroker object type below `parentId`, e.g. type `state` below
     * `0_userdata.0.temperature`. Only the `parentId` subtree is read, an empty `parentId` reads
     * everything — pass a filter when browsing without one.
     */
    getObjectsOfType(type: string, parentId: string): Promise<IObjectWithId[]>;
}
