
export interface ITypeDefinitionService {
    downloadIobrokerTypeDefinitionsFromGithubAndSave(): Promise<void>;
    downloadNodeTypeDefinitionsFromNpmAndSave(): Promise<void>;
    createConfig(): Promise<void>;
    createGlobalTypeDefinitions(): Promise<void>;
}
