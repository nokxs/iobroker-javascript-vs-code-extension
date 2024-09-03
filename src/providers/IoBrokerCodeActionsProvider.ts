import { injectable } from "inversify";
import { IIobrokerCodeActionItemProvider } from "./IIoBrokerCodeActionsProvider";
import { TextDocument, Range, Selection, ProviderResult, Command, CodeAction, CodeActionKind, WorkspaceEdit, CancellationToken, CodeActionContext } from "vscode";

@injectable()
export class IobrokerCodeActionItemProvider implements IIobrokerCodeActionItemProvider {
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]> {
        const codeAction = new CodeAction("Add iobroker state name as comment", CodeActionKind.RefactorRewrite);
        codeAction.edit = new WorkspaceEdit();
        codeAction.edit.replace(document.uri, new Range(range.start, range.start.translate(0, 2)), "test");

        return [codeAction];
    }
    resolveCodeAction?(codeAction: CodeAction, token: CancellationToken): ProviderResult<CodeAction> {
        return codeAction;
    }  
}