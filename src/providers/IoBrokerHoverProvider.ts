import { inject, injectable } from "inversify";
import { CancellationToken, Hover, Position, TextDocument } from "vscode";
import { IStateAndObjectRemoteService } from "../services/stateRemote/IStateAndObjectRemoteService";
import TYPES from "../Types";
import { IIobrokerHoverProvider } from "./IIobrokerHoverProvider";
import { IObjectRepositoryService } from "../services/StateRepository/IObjectRepositoryService";

@injectable()
export class IoBrokerHoverProvider implements IIobrokerHoverProvider {
    constructor(
        @inject(TYPES.services.stateAndObjectRemoteService) private stateAndObjectRemoteService: IStateAndObjectRemoteService,
        @inject(TYPES.services.objectRepositoryService) private objectRepositoryService: IObjectRepositoryService
    ) { }

    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /["'`].*?["'`]/);
        if (wordRange) {
            // slice removes first and last char
            const id = document.getText(wordRange).slice(1, -1);
            const state = await this.stateAndObjectRemoteService.getState(id);

            if (!state || token.isCancellationRequested) {
                return undefined;
            }

            const iobrokerObject = this.objectRepositoryService.getObjectById(id) ?? undefined;
            
            // do not fix the formatting or tooltip will be formatted wrongly
            return { contents: [`**${id}**

${iobrokerObject?.common?.name}     
                
- Value: *${state.val}*
- Ack: *${state.ack}*
- Last Changed: *${this.formatDate(state.lc)}*
- Timestamp: *${this.formatDate(state.ts)}*
- Read/Write: *${iobrokerObject?.common?.read ?? "unknown"}/${iobrokerObject?.common?.write ?? "unknown"}*
- Role: *${iobrokerObject?.common?.role ?? "unknown"}*
- Type: *${iobrokerObject?.common?.type ?? "unknown"}*`] };
        }

        return undefined;
    }

    private formatDate(unixDate: number): string {
        const date = new Date(unixDate);
        return `${date.toLocaleString()}.${("00" + date.getMilliseconds()).slice(-3)}`;
    }
}