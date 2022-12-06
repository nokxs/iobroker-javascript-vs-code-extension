import { inject, injectable } from "inversify";
import { CancellationToken, CompletionItem, CompletionItemKind, Position, TextDocument } from "vscode";
import { IObjectList } from "../models/IObjectList";
import { IObjectRepositoryService } from "../services/StateRepository/IObjectRepositoryService";
import TYPES from "../Types";
import { IIobrokerCompletionItemProvider } from "./IIobrokerCompletionItemProvider";

@injectable()
export class IoBrokerCompletionItemProvider implements IIobrokerCompletionItemProvider {
    constructor(
        @inject(TYPES.services.objectRepositoryService) private objectRepositoryService: IObjectRepositoryService,
    ) { }

    async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken): Promise<CompletionItem[] | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /["'`].*?["'`]/);
        if (wordRange) {
            // slice removes first and last char
            const text = document.getText(wordRange).slice(1, -1);
            const matchingObjects = this.objectRepositoryService.findMatchingObjects(text);

            if (token.isCancellationRequested) {
                return undefined;
            }

            return this.createCompletionList(matchingObjects);
        }

        return undefined;
    }

    private createCompletionList(matchingObjects: IObjectList | undefined) {
        const items: CompletionItem[] = [];
        
        for (const id in matchingObjects) {
            const obj = matchingObjects[id];
            const parts = id.split(".");
            const name = <any>(obj?.common.name);
            const isState = obj?.type === "state";

            items.push({
                label: parts[parts.length - 1],
                detail: name?.en ?? name ?? undefined,
                commitCharacters: ["."],
                kind: isState ? CompletionItemKind.Variable : CompletionItemKind.Folder
            });
        }

        return items;
    }
}
