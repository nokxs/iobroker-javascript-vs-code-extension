export interface IObjectCommon {
    /** ioBroker allows a plain name or per-language names. */
    name?: string | { en: string };
    /** State role such as `value.temperature`, `switch` or `level.dimmer`. */
    role?: string;
    type?: string;
    /** Unit of a state, e.g. `°C` or `%`. */
    unit?: string;
    /** Whether the state is readable; ioBroker stores a boolean, absent means true. */
    read?: boolean;
    /** Whether the state is writable; ioBroker stores a boolean, absent means true. */
    write?: boolean;
}
