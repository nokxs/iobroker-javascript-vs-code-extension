export interface ILogMessage {
    severity: string;
    ts: number;
    message: string;
    from: string;
    _id: number;
}