/**
 * The engine instance a script runs in, e.g. `system.adapter.javascript.0`.
 */
export function getJsInstanceNumber(engine: string | undefined): number {
    if (!engine) {
        return 0;
    }

    const lastDot = engine.lastIndexOf(".");
    const parsed = Number.parseInt(engine.substring(lastDot + 1), 10);

    return Number.isNaN(parsed) ? 0 : parsed;
}
