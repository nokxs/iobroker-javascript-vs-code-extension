/**
 * A host command that is never answered - because the host is unreachable, or because the
 * controller does not know it - must not leave the caller waiting forever.
 */
export const HOST_COMMAND_TIMEOUT_MS = 10 * 1000;

const PERMISSION_ERROR = "the logged in user is not allowed to read logs. Ask the user to grant the 'sendToHost' permission.";

export type LogLinesAnswer = { lines: string[] } | { error: string };

/**
 * Reads the log lines from the answer of a host `getLogs` command sent with `sendToHost`.
 *
 * The socket answers with the raw result of the host command. A failed permission check or a
 * request the host could not answer comes back as an object with an `error` property, and some
 * controllers answer with the plain string `'permissionError'`.
 */
export function readLogLinesAnswer(answer: unknown): LogLinesAnswer {
    if (answer === "permissionError") {
        return { error: PERMISSION_ERROR };
    }

    if (typeof answer === "object" && answer !== null && "error" in answer) {
        const error = (answer as { error?: unknown }).error;
        return { error: error === "permissionError" ? PERMISSION_ERROR : `the host reported an error: ${String(error)}.` };
    }

    if (!Array.isArray(answer) || answer.some(line => typeof line !== "string")) {
        return { error: "the host returned an invalid response." };
    }

    // `getLogs` appends the current size of the log file as the last item.
    return { lines: (answer as string[]).slice(0, -1) };
}
