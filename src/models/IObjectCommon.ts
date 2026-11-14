export interface IObjectCommon {
    /** ioBroker allows a plain name or per-language names. */
    name?: string | { en: string };
    /** State role such as `value.temperature`, `switch` or `level.dimmer`. */
    role?: string;
    type?: string;
    /** Unit of a state, e.g. `°C` or `%`. */
    unit?: string;
    read?: string;
    write?: string;
}
