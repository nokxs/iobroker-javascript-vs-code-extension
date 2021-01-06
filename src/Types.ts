/* eslint-disable @typescript-eslint/naming-convention */
const TYPES = {
    services: {
        config: Symbol.for("ConfigService"),
        connection: Symbol.for("ConnectionService"),
        file: Symbol.for("FileService"),
        command: Symbol.for("CommandService"),
        workspace: Symbol.for("WorkspaceService"),
        script: Symbol.for("ScriptService"),
        log: Symbol.for("LogService"),
        typeDefinition: Symbol.for("TypeDefinitionService")
    },
    views: {
        scriptExplorer: Symbol.for("ScriptExplorerView")
    },
    command: Symbol.for("Command"),
    startup: Symbol.for("Startup")
};

export default TYPES;
