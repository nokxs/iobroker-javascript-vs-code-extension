import { IScript } from "../../models/IScript";

export interface IScriptChangedEventListener {
    onScriptChanged(id: string, script: IScript): void;
}
