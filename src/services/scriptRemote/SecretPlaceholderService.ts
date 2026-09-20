import { promises as fs } from 'fs';
import * as path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '../../Types';
import { IWorkspaceService } from '../workspace/IWorkspaceService';
import { ISecretPlaceholderService } from './ISecretPlaceholderService';

const SECRET_PLACEHOLDER_PATTERN_TEXT = "__IOBROKER_SECRET_([A-Za-z0-9_]+)__";
export const SECRET_PLACEHOLDER_PATTERN = new RegExp(SECRET_PLACEHOLDER_PATTERN_TEXT, "g");
const SECRET_PLACEHOLDER_EXISTS_PATTERN = new RegExp(SECRET_PLACEHOLDER_PATTERN_TEXT);

@injectable()
export class SecretPlaceholderService implements ISecretPlaceholderService {
    constructor(
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService
    ) {}

    replaceSecretPlaceholders(scriptSource: string, envContent: string): string {
        const env = this.parseEnvContent(envContent);

        return scriptSource.replace(SECRET_PLACEHOLDER_PATTERN, (placeholder, key) => {
            return env.has(key) ? env.get(key)! : placeholder;
        });
    }

    async replaceSecretPlaceholdersFromEnvFile(scriptSource: string): Promise<string> {
        const workspacePath = this.workspaceService.workspaceToUse?.uri?.fsPath;
        if (!SECRET_PLACEHOLDER_EXISTS_PATTERN.test(scriptSource) || !workspacePath) {
            return scriptSource;
        }

        const envPath = path.join(workspacePath, ".env");
        try {
            return this.replaceSecretPlaceholders(scriptSource, await fs.readFile(envPath, "utf8"));
        } catch {
            return scriptSource;
        }
    }

    private parseEnvContent(envContent: string): Map<string, string> {
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
            const value = this.removeWrappingQuotes(rawValue);
            env.set(key, value);
        });

        return env;
    }

    private removeWrappingQuotes(value: string): string {
        if (value.length >= 2) {
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                return value.substring(1, value.length - 1);
            }
        }

        return value;
    }
}
