// Represents an iobroker script
export interface Script{
    id: string;
    value: Value;
}

export interface Value {
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
