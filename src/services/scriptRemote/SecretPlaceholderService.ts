import { promises as fs } from 'fs';
import * as path from 'path';

export const SECRET_PLACEHOLDER_PATTERN = /__IOBROKER_SECRET_([A-Za-z0-9_]+)__/g;
const SECRET_PLACEHOLDER_EXISTS_PATTERN = /__IOBROKER_SECRET_([A-Za-z0-9_]+)__/;

export function replaceSecretPlaceholders(scriptSource: string, envContent: string): string {
    const env = parseEnvContent(envContent);

    return scriptSource.replace(SECRET_PLACEHOLDER_PATTERN, (placeholder, key) => {
        return env.has(key) ? env.get(key)! : placeholder;
    });
}

export async function replaceSecretPlaceholdersFromEnvFile(scriptSource: string, workspacePath: string | undefined): Promise<string> {
    if (!SECRET_PLACEHOLDER_EXISTS_PATTERN.test(scriptSource) || !workspacePath) {
        return scriptSource;
    }

    const envPath = path.join(workspacePath, ".env");
    try {
        return replaceSecretPlaceholders(scriptSource, await fs.readFile(envPath, "utf8"));
    } catch {
        return scriptSource;
    }
}

function parseEnvContent(envContent: string): Map<string, string> {
    const env = new Map<string, string>();
    const lines = envContent.split(/\r?\n/);

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmedLine.indexOf("=");
        if (separatorIndex <= 0) {
            return;
        }

        const key = trimmedLine.substring(0, separatorIndex).trim();
        const rawValue = trimmedLine.substring(separatorIndex + 1).trim();
        const value = removeWrappingQuotes(rawValue);
        env.set(key, value);
    });

    return env;
}

function removeWrappingQuotes(value: string): string {
    if (value.length >= 2) {
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length - 1);
        }
    }

    return value;
}
