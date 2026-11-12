/** The subset of the VS Code disposable that the status bar messages need. */
export interface IStatusBarMessage {
    dispose(): void
}

export interface IStatusBarService {
    init(): void
    setText(text: string): void
    setStatusBarMessage(text: string): IStatusBarMessage
}
