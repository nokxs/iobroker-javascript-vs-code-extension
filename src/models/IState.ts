export interface IState  {
    val: any;
    ack: boolean;
    ts: number;
    lc: number;
    from: string;
    expire?: boolean
}
