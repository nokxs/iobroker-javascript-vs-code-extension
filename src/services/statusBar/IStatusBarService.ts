
export interface IStatusBarService {
    init(): void
    setText(text: string): void
    setStatusBarMessage(text: string): void
}
