export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message || error.name;
    }

    if (typeof error === "string") {
        return error;
    }

    if (error === null || typeof error !== "object") {
        return String(error);
    }

    const details = error as { message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown; response?: unknown };
    const message = typeof details.message === "string" ? details.message : undefined;
    const response = details.response && typeof details.response === "object" ? details.response as { status?: unknown } : undefined;
    const status = details.statusCode ?? details.status ?? response?.status;
    const code = details.code;
    const extraDetails = [
        typeof status === "string" || typeof status === "number" ? `HTTP ${status}` : undefined,
        typeof code === "string" ? `code ${code}` : undefined
    ].filter((detail): detail is string => detail !== undefined);

    if (message) {
        return extraDetails.length > 0 ? `${message} (${extraDetails.join(", ")})` : message;
    }

    if (extraDetails.length > 0) {
        return extraDetails.join(", ");
    }

    const properties = Object.keys(error);
    return properties.length > 0
        ? `Unknown error object (properties: ${properties.join(", ")})`
        : "Unknown error object";
}
