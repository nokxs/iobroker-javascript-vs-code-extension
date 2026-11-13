import { IStatusBarMessage, IStatusBarService } from "../statusBar/IStatusBarService";

/** A stdio server has no status bar. The two connection services only use it for progress hints. */
export class NoStatusBarService implements IStatusBarService {
    init(): void {
        // nothing to show
    }

    setText(): void {
        // nothing to show
    }

    setStatusBarMessage(): IStatusBarMessage {
        return { dispose: () => undefined };
    }
}
