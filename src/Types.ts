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
        log: Symbol.for("LogService"),
        typeDefinition: Symbol.for("TypeDefinitionService"),
        iobrokerConnection: Symbol.for("IobrokerConnection"),
        jsInstance: Symbol.for("JsInstanceService")
    },
    views: {
        scriptExplorer: Symbol.for("ScriptExplorerView")
    },
    command: Symbol.for("Command"),
    startup: Symbol.for("Startup")
};

export default TYPES;
