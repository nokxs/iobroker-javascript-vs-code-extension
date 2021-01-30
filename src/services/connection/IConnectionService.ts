import { IConnectionEventListener } from "./IConnectionEventListener";
import { LogMessage } from "../../models/LogMessage";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";

export interface IConnectionService {
    isConnected: Boolean;
    
    connect(uri: Uri): Promise<void>
    disconnect(): Promise<void>
    
    registerConnectionEventListener(listener: IConnectionEventListener): void

    registerForLogs(logAction: (logMessage: LogMessage) => void): Promise<void>
    unregisterForLogs(): Promise<void>

    registerForObjectChange(pattern: string, onChangeAction: (id: string, value: any) => void): Promise<void>
    unregisterObjectChange(pattern: string): Promise<void>

    getObject<TObject>(objectId: string | ScriptId): Promise<TObject>
    setObject(objectId: string | ScriptId, obj: any): Promise<void>
    deleteObject(objectId: string| ScriptId): Promise<void>
    extendObject(objectId: string | ScriptId, obj: any): Promise<void>

    getSystemObjectView<TResult>(type: string, startKey: string, endKey: string): Promise<TResult[]>
}
