import { IConnectionEventListener } from "./IConnectionEventListener";
import { ILogMessage } from "../../models/ILogMessage";
import { ScriptId } from "../../models/ScriptId";
import { Uri } from "vscode";
import { IState } from "../../models/IState";
import { IObjectList } from "../../models/IObjectList";

export interface IConnectionService {
    isConnected: boolean;
    
    connect(uri: Uri, autoReconnect: boolean, allowSelfSignedCertificate: boolean): Promise<void>
    connectWithToken(uri: Uri, autoReconnect: boolean, allowSelfSignedCertificate: boolean, accessToken: string): Promise<void>
    
    disconnect(): Promise<void>
    
    registerConnectionEventListener(listener: IConnectionEventListener): void

    registerForLogs(logAction: (logMessage: ILogMessage) => void): Promise<void>
    unregisterForLogs(): Promise<void>

    registerForObjectChange(pattern: string, onChangeAction: (id: string, value: any) => void): Promise<void>
    unregisterObjectChange(pattern: string): Promise<void>

    getAllObjects(): Promise<IObjectList>
    getObject<TObject>(objectId: string | ScriptId): Promise<TObject>
    setObject(objectId: string | ScriptId, obj: any): Promise<void>
    deleteObject(objectId: string| ScriptId): Promise<void>
    extendObject(objectId: string | ScriptId, obj: any): Promise<void>

    getSystemObjectView<TResult>(type: string, startKey: string, endKey: string): Promise<TResult[]>

    getState(id: string): Promise<IState>
}
