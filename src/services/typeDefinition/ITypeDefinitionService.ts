
export interface ITypeDefinitionService {
    downloadFromGithubAndSave(): Promise<void>;
    createTsConfig(): Promise<void>;
}
