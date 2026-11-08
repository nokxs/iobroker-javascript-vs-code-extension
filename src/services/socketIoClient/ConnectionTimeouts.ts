export interface ConnectionTimeouts {
    /** Max time for the initial connect (incl. handshake) before the connect call rejects. */
    connectionTimeoutMs: number;
    /** Max time between opening the websocket and receiving the `___ready___` message. */
    readyTimeoutMs: number;
    /** Max time to wait for an answer to `authenticate`. */
    authTimeoutMs: number;
    /**
     * Send a ping when nothing was sent for this long. The ioBroker ws-server closes a socket that sent
     * nothing for 15 s, and its own ping can be stuck behind a large response on slow links.
     */
    pingIntervalMs: number;
    /** Treat the connection as dead when nothing was received for this long. */
    heartbeatTimeoutMs: number;
    /** First reconnect delay; doubles with every failed attempt. */
    reconnectBaseDelayMs: number;
    /** Upper bound for the reconnect delay. */
    reconnectMaxDelayMs: number;
    /**
     * Fixed delay right after an established connection was lost. Short network outages (Wi-Fi, VPN)
     * would otherwise grow the backoff while offline and delay the reconnect long after the network is back.
     */
    fastReconnectDelayMs: number;
    /** How long after a connection loss the fixed fast delay is used before the exponential backoff starts. */
    fastReconnectWindowMs: number;
}

/** A new fast phase starts at most once per this period, so a flapping server is not hammered. */
export const FAST_RECONNECT_COOLDOWN_MS = 60000;

export const DEFAULT_CONNECTION_TIMEOUTS: Readonly<ConnectionTimeouts> = Object.freeze({
    connectionTimeoutMs: 30000,
    readyTimeoutMs: 20000,
    authTimeoutMs: 15000,
    pingIntervalMs: 5000,
    heartbeatTimeoutMs: 45000,
    reconnectBaseDelayMs: 2000,
    reconnectMaxDelayMs: 30000,
    fastReconnectDelayMs: 1000,
    fastReconnectWindowMs: 45000,
});

export interface ConnectionTimeoutConfig {
    connectionTimeoutMs?: unknown;
    readyTimeoutMs?: unknown;
    heartbeatTimeoutMs?: unknown;
    reconnectMaxDelayMs?: unknown;
}

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;

function normalizeMs(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
}

export function resolveConnectionTimeouts(config: ConnectionTimeoutConfig | undefined): ConnectionTimeouts {
    const d = DEFAULT_CONNECTION_TIMEOUTS;
    const heartbeatTimeoutMs = normalizeMs(config?.heartbeatTimeoutMs, d.heartbeatTimeoutMs);
    return {
        connectionTimeoutMs: normalizeMs(config?.connectionTimeoutMs, d.connectionTimeoutMs),
        readyTimeoutMs: normalizeMs(config?.readyTimeoutMs, d.readyTimeoutMs),
        authTimeoutMs: d.authTimeoutMs,
        // Keep at least two pings inside one heartbeat window.
        pingIntervalMs: Math.min(d.pingIntervalMs, Math.max(MIN_TIMEOUT_MS, Math.floor(heartbeatTimeoutMs / 3))),
        heartbeatTimeoutMs,
        reconnectBaseDelayMs: d.reconnectBaseDelayMs,
        reconnectMaxDelayMs: normalizeMs(config?.reconnectMaxDelayMs, d.reconnectMaxDelayMs),
        fastReconnectDelayMs: d.fastReconnectDelayMs,
        fastReconnectWindowMs: d.fastReconnectWindowMs,
    };
}

export function isFastReconnectPhase(now: number, fastPhaseStartedAt: number | undefined, windowMs: number): boolean {
    return fastPhaseStartedAt !== undefined && now - fastPhaseStartedAt < windowMs;
}

/**
 * Exponential backoff with +/-20 % jitter. `attempt` starts at 1.
 */
export function computeReconnectDelay(attempt: number, baseMs: number, maxMs: number, random: () => number = Math.random): number {
    const exponent = Math.min(Math.max(attempt, 1) - 1, 16);
    const raw = Math.min(maxMs, baseMs * Math.pow(2, exponent));
    const jitter = raw * 0.2 * (random() * 2 - 1);
    return Math.max(baseMs, Math.min(maxMs, Math.round(raw + jitter)));
}
