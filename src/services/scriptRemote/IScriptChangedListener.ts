import { IScript } from "../../models/IScript";

export interface IScriptChangedEventListener {
    onScriptChanged(id: string | undefined, script: IScript | undefined): void;
}
