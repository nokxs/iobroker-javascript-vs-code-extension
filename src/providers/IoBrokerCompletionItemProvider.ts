import { inject, injectable } from "inversify";
import { CancellationToken, CompletionItem, CompletionItemKind, MarkdownString, Position, TextDocument } from "vscode";
import { IObjectList } from "../models/IObjectList";
import { IObjectRepositoryService } from "../services/StateRepository/IObjectRepositoryService";
import TYPES from "../Types";
import { IIobrokerCompletionItemProvider } from "./IIobrokerCompletionItemProvider";
import { IObject } from "../models/IObject";

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
            const statePart = parts[parts.length - 1];
            const nameExpanded = name?.en ?? name ?? undefined;

            items.push({
                label: {
                    label: statePart,
                    description: nameExpanded
                },
                insertText: statePart,
                filterText: statePart + nameExpanded,
                documentation: this.getDocumentation(<IObject>obj),
                commitCharacters: ["."],
                kind: isState ? CompletionItemKind.Variable : CompletionItemKind.Folder
            });
        }

        return items;
    }

    private getDocumentation(obj: IObject): MarkdownString | undefined {
        let markdownString = new MarkdownString();
        markdownString.supportHtml = true;

        if (obj) {
            if (obj.common.role) {
                markdownString.appendMarkdown(`**Role:** ${obj.common.role}<br>`);
            }

            if (obj.common.type) {
                markdownString.appendMarkdown(`**Type:** ${obj.common.type}<br>`);
            }
            
            if (obj.common.read !== undefined) {
                markdownString.appendMarkdown(`**Readable:** ${obj.common.read}<br>`);
            }

            if (obj.common.write !== undefined) {
                markdownString.appendMarkdown(`**Writable:** ${obj.common.write}<br>`);
            }

            return markdownString;        
        }

        return undefined;
    }
}
