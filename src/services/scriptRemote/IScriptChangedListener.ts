import { Script } from "../../models/Script";

export interface IScriptChangedEventListener {
    onScriptChanged(id: string, script: Script): void;
}
