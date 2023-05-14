import { TreeDataProvider, TreeView } from "vscode";
import { OnlyLocalDirectoryItem } from "./OnlyLocalDirectoryItem";
import { OnlyLocalScriptItem } from "./OnlyLocalScriptItem";
import { ScriptDirectory } from "./ScriptDirectory";
import { ScriptItem } from "./ScriptItem";

export interface IScriptExplorerProvider extends TreeDataProvider<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem> {
    getItem(id: string): undefined | ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem
    treeView: TreeView<ScriptItem | OnlyLocalScriptItem | ScriptDirectory | OnlyLocalDirectoryItem>
}
