import { TreeDataProvider, TreeView, Uri } from "vscode";
import { OnlyLocalDirectoryItem } from "./OnlyLocalDirectoryItem";
import { OnlyLocalScriptItem } from "./OnlyLocalScriptItem";
import { ScriptDirectory } from "./ScriptDirectory";
import { ScriptItem } from "./ScriptItem";

export type ScriptExplorerItem = ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem;

export interface IScriptExplorerProvider extends TreeDataProvider<ScriptExplorerItem> {
    autoRevealEnabled: boolean
    treeView: TreeView<ScriptExplorerItem>

    getParent(element: ScriptExplorerItem): ScriptExplorerItem | undefined
    onActiveEditorChanged(uri: Uri | undefined): void
    revealCurrentScript(): Promise<void>
    setAutoRevealEnabled(enabled: boolean): Promise<void>
    updateAutoSyncContext(): void
}
