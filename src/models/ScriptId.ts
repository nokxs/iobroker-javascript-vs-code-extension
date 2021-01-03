export class ScriptId extends String {
    constructor(s: string) {
        if (!s.startsWith("script.js.")) {
            throw new Error(`The script id '${s}' does not start with 'script.js.'`);
        }

        super(s);
    }
}
