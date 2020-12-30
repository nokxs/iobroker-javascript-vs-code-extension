// Represents an iobroker script
export interface ScriptObject{
    id: string;
    value: Script;
}
export interface Script {
    common: Common;
    type: string;
    from: string;
    user: string;
    _id: string;
}

export interface Common {
    name: string;
    expert: boolean;
    engineType: string;
    engine: string;
    source: string;
    debug: boolean;
    verbose: boolean;
}
