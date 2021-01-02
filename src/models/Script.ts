export class ScriptId extends String{
    constructor(s: string) {
        if (!s.startsWith("script.js.")) {
            throw new Error(`The script id '${s}' does not start with 'script.js.'`);
        }
        
        super(s);
    }
}

// Represents an iobroker script
export interface ScriptObject{
    id: string;
    value: Script;
}
export interface Script {
    common: Common;
    type?: string;
    from?: string;
    user?: string;
    _id: ScriptId;
}

export interface Common {
    name?: string;
    expert?: boolean;
    engineType?: string;
    engine?: string;
    source?: string;
    debug?: boolean;
    verbose?: boolean;
    enabled?: boolean;
}
