import { inject, injectable } from "inversify";
import { CancellationToken, CompletionContext, CompletionItem, Position, TextDocument } from "vscode";
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
        token: CancellationToken, 
        context: CompletionContext): Promise<CompletionItem[] | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /["'].*?["']/);
        if (wordRange) {
            // slice removes first and last char
            const text = document.getText(wordRange).slice(1, -1);
            const matchingObjects = this.objectRepositoryService.findMatchingObjects(text);

            if (token.isCancellationRequested) {
                return undefined;
            }           

            const items: CompletionItem[] = [];
            for (const id in matchingObjects) {
                const obj = matchingObjects[id];
                const parts = id.split(".");
                const name = <any>(obj?.common.name);
                items.push({
                            label: parts[parts.length - 1],
                            detail: name?.en ?? name ?? undefined
                        });
            }

            return items;
        }

        return undefined;
    }
}


        // class GoCompletionItemProvider implements CompletionItemProvider {
        //     public provideCompletionItems(
        //         document: TextDocument, position: Position):
        //         Promise<CompletionItem[]> | undefined {
        //         const wordRange = document.getWordRangeAtPosition(position, /".*\.[0-9]\..*"/);
        //         if (wordRange) {
        //             const text  = document.getText(wordRange);
        //             return new Promise<CompletionItem[]>((resolve) => {
        //                 resolve([{label: text, detail: "Test"}]);
        //             });
        //         }

        //         return undefined;
        //     }
        // }

        // const provider = new GoCompletionItemProvider();
        // languages.registerCompletionItemProvider("javascript", provider, '"', "'", "#");