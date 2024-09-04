import { inject, injectable } from "inversify";
import { IIobrokerCodeActionItemProvider } from "./IIoBrokerCodeActionsProvider";
import { TextDocument, Range, Selection, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, CancellationToken, CodeActionContext } from "vscode";
import { IObjectRepositoryService } from "../services/StateRepository/IObjectRepositoryService";
import TYPES from "../Types";
import { IObject } from "../models/IObject";

@injectable()
export class IobrokerCodeActionItemProvider implements IIobrokerCodeActionItemProvider {
    constructor(
        @inject(TYPES.services.objectRepositoryService) private objectRepositoryService: IObjectRepositoryService,
    ) { }
    
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]> {
        const wordRange = document.getWordRangeAtPosition(range.start, /["'`].*?["'`]/);
        if (!wordRange) {
            return;
        }

        const ioBrokerId = document.getText(wordRange).slice(1, -1);
        const iobrokerObject = this.objectRepositoryService.getObjectById(ioBrokerId);
        const name = this.getName(iobrokerObject);  

        if (token.isCancellationRequested || !name) {
            return;
        }      
        
        const codeAction = new CodeAction("Add iobroker state name as comment", CodeActionKind.RefactorRewrite);       
        codeAction.edit = new WorkspaceEdit();
        codeAction.edit.replace(document.uri, new Range(wordRange.end, wordRange.end), ` /** ${name} **/`);

        return [codeAction];
    }

    private getName(iobrokerObject: IObject | undefined) : string | undefined {
        if (!iobrokerObject) {
            return;
        }

        if (typeof iobrokerObject.common.name === 'object' && iobrokerObject.common.name !== null && 'en' in iobrokerObject.common.name) {
            return iobrokerObject.common.name.en;
        } else {
            return iobrokerObject.common.name;
        }
    }
}