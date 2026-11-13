/* eslint-disable @typescript-eslint/naming-convention */
declare const __BUILD_VERSION__: string | undefined;

/**
 * Injected by webpack `DefinePlugin` from the release tag. Falling back to a dev value keeps a
 * local `tsc` build and a test run working.
 */
export const BUILD_VERSION = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : "0.0.0-dev";
