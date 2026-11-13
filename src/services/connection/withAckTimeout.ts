/**
 * Design section 10.4: `SocketIoClient` has no working acknowledgement timeout, so a lost socket
 * callback leaves the promise pending forever. Every object operation is therefore bounded here;
 * a timeout is an ordinary rejection, which the caller reports as `server_error`.
 */
export const SOCKET_ACK_TIMEOUT_MS = 10 * 1000;

export function withAckTimeout<T>(operation: Promise<T>, label: string, timeoutMs: number = SOCKET_ACK_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} was not acknowledged by ioBroker within ${Math.round(timeoutMs / 1000)} seconds.`));
        }, timeoutMs);

        operation.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}
