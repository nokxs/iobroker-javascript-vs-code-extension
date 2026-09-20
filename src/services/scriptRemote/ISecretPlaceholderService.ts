export interface ISecretPlaceholderService {
    replaceSecretPlaceholders(scriptSource: string, envContent: string): string;
    replaceSecretPlaceholdersFromEnvFile(scriptSource: string): Promise<string>;
}
