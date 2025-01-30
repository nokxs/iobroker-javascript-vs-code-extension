import { IObject } from "../../models/IObject";

export interface IObjectChangedEventListener {
    onObjectChanged(id: string | undefined, value: IObject | undefined): void;
}
