/* eslint-disable @typescript-eslint/naming-convention */
const TYPES = {
    services: {
        configCreation: Symbol.for("ConfigCreationService"),
        configRepository: Symbol.for("ConfigRepositoryService"),
        connection: Symbol.for("ConnectionService"),
        file: Symbol.for("FileService"),
        command: Symbol.for("CommandService"),
        workspace: Symbol.for("WorkspaceService"),
        script: Symbol.for("ScriptService"),
        scriptId: Symbol.for("ScriptIdService"),
        scriptRemote: Symbol.for("ScriptRemoteService"),
        scriptRepository: Symbol.for("ScriptRepositoryService"),
        directory: Symbol.for("DirectoryService"),
        log: Symbol.for("LogService"),
        typeDefinition: Symbol.for("TypeDefinitionService"),
        iobrokerConnection: Symbol.for("IobrokerConnection"),
        jsInstance: Symbol.for("JsInstanceService"),
        socketIoClient: Symbol.for("SocketIoClient")
    },
    views: {
        scriptExplorer: Symbol.for("ScriptExplorerView")
    },
    command: Symbol.for("Command"),
    startup: Symbol.for("Startup")
};

export default TYPES;
