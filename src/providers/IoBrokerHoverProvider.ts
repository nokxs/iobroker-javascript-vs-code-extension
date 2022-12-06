import { inject, injectable } from "inversify";
import { CancellationToken, Hover, Position, TextDocument } from "vscode";
import { IStateAndObjectRemoteService } from "../services/stateRemote/IStateAndObjectRemoteService";
import TYPES from "../Types";
import { IIobrokerHoverProvider } from "./IIobrokerHoverProvider";

@injectable()
export class IoBrokerHoverProvider implements IIobrokerHoverProvider {
    constructor(
        @inject(TYPES.services.stateAndObjectRemoteService) private stateAndObjectRemoteService: IStateAndObjectRemoteService,
    ) { }

    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /["'`].*?\.[0-9]\..*?["'`]/);
        if (wordRange) {
            // slice removes first and last char
            const id = document.getText(wordRange).slice(1, -1);
            const state = await this.stateAndObjectRemoteService.getState(id);

            if (!state || token.isCancellationRequested) {
                return undefined;
            }
            
            // do not fix the formatting or tooltip will be formatted wrongly
            return { contents: [`**${id}**\n\n
- Value: *${state.val}*
- Ack: *${state.ack}*
- Last Changed: *${this.formatDate(state.lc)}*
- Timestamp: *${this.formatDate(state.ts)}*`] };
        }

        return undefined;
    }

    private formatDate(unixDate: number): string {
        const date = new Date(unixDate);
        return `${date.toLocaleString()}.${("00" + date.getMilliseconds()).slice(-3)}`;
    }
}