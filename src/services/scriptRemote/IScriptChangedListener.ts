export interface IScriptChangedEventListener {
    onScriptChanged(id: string | undefined): void;

    onNoScriptAvailable(): void;
}
