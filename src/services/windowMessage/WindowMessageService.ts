
import { inject, injectable } from "inversify";
import { window } from "vscode";
import TYPES from '../../Types';
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { IWindowMessageService } from "./IWindowMessageService";

@injectable()
export class WindowMessageService implements IWindowMessageService {
    constructor(
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService
      ) { }

    showInformation(message: string): void {
        window.showInformationMessage(message);
        this.debugLogService.log(message, "Message");
    }

    showWarning(message: string): void {
        window.showWarningMessage(message);
        this.debugLogService.logWarning(message, "Message");
    }

    showError(message: string): void {
        window.showErrorMessage(message);
        this.debugLogService.logError(message, "Message");
    }       
}