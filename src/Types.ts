/* eslint-disable @typescript-eslint/naming-convention */
const TYPES = {
    services: {
        configCreation: Symbol.for("ConfigCreationService"),
        configReaderWriter: Symbol.for("ConfigReaderWriterService"),
        connection: Symbol.for("ConnectionService"),
        file: Symbol.for("FileService"),
        command: Symbol.for("CommandService"),
        workspace: Symbol.for("WorkspaceService"),
        script: Symbol.for("ScriptService"),
        log: Symbol.for("LogService"),
        typeDefinition: Symbol.for("TypeDefinitionService"),
        iobrokerConnection: Symbol.for("IobrokerConnection")
    },
    views: {
        scriptExplorer: Symbol.for("ScriptExplorerView")
    },
    command: Symbol.for("Command"),
    startup: Symbol.for("Startup")
};

export default TYPES;
