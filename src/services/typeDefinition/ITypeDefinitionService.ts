
export interface ITypeDefinitionService {
    downloadFromGithubAndSave(): Promise<void>;
    createConfig(): Promise<void>;
    createGlobalTypeDefinitions(): Promise<void>;
}
