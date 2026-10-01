import * as assert from 'assert';
import { CancellationToken, Position, TextDocument } from 'vscode';
import { IoBrokerHoverProvider } from '../../providers/IoBrokerHoverProvider';
import { IObjectRepositoryService } from '../../services/StateRepository/IObjectRepositoryService';
import { IStateAndObjectRemoteService } from '../../services/stateRemote/IStateAndObjectRemoteService';

suite('IoBrokerHoverProvider Test Suite', () => {
    test('does not request state for strings ending in a period', async () => {
        let requestedState = false;
        const stateRemoteService = {
            getState: async () => {
                requestedState = true;
                return undefined;
            },
        } as unknown as IStateAndObjectRemoteService;
        const objectRepositoryService = {} as IObjectRepositoryService;
        const provider = new IoBrokerHoverProvider(stateRemoteService, objectRepositoryService);
        const document = {
            getWordRangeAtPosition: () => ({}),
            getText: () => '"Light (${trigger}): Switching ON."',
        } as unknown as TextDocument;

        const hover = await provider.provideHover(
            document,
            {} as Position,
            { isCancellationRequested: false } as CancellationToken,
        );

        assert.strictEqual(hover, undefined);
        assert.strictEqual(requestedState, false);
    });
});
