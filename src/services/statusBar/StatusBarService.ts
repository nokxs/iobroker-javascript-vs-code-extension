import { StatusBarAlignment, window } from "vscode";

import { IStatusBarService } from "./IStatusBarService";
import { inject, injectable } from "inversify";
import TYPES from "../../Types";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import CONSTANTS from "../../Constants";

@injectable()
export class StatusBarService implements IStatusBarService {
    private statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 250);
    
    constructor(
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService
      ) { }

    init(): void {
        this.statusBarItem.text = "$(warning) ioBroker disconnected";
        this.statusBarItem.command = "iobroker-javascript.connect";
        this.statusBarItem.show();
    }

    setText(text: string): void {
        this.statusBarItem.text = text;
        this.debugLogService.log(text, "StatusBar");
    }

    setStatusBarMessage(text: string): void {
        window.setStatusBarMessage(text, CONSTANTS.statusBarMessageTime);
        this.debugLogService.log(text, "StatusBarMessage");
    }
}
