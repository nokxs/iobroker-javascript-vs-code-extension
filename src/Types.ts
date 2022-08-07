/* eslint-disable @typescript-eslint/naming-convention */
const TYPES = {
    services: {
        configCreation: Symbol.for("ConfigCreationService"),
        configRepository: Symbol.for("ConfigRepositoryService"),
        file: Symbol.for("FileService"),
        command: Symbol.for("CommandService"),
        workspace: Symbol.for("WorkspaceService"),
        script: Symbol.for("ScriptService"),
        scriptId: Symbol.for("ScriptIdService"),
        scriptRemote: Symbol.for("ScriptRemoteService"),
        scriptRepository: Symbol.for("ScriptRepositoryService"),
        localOnlyScriptRepository: Symbol.for("LocalOnlyScriptRepositoryService"),
        directory: Symbol.for("DirectoryService"),
        log: Symbol.for("LogService"),
        typeDefinition: Symbol.for("TypeDefinitionService"),
        login: Symbol.for("LoginService"),
        loginCredentials: Symbol.for("LoginServiceCredentials"),
        iobrokerConnection: Symbol.for("IobrokerConnection"),
        jsInstance: Symbol.for("JsInstanceService"),
        socketIoClient: Symbol.for("SocketIoClient"),
        adminVersionDetector: Symbol.for("AdminVersionDetector"),
        debugLogService: Symbol.for("DebugLogService"),
        statusBarService: Symbol.for("StatusBarService"),
        
        connectionServiceProvider: Symbol.for("ConnectionServiceProvider"),
        connectionAdmin4: Symbol.for("ConnectionServiceAdmin4"),
        connectionAdmin5: Symbol.for("ConnectionServiceAdmin5"),
    },
    views: {
        scriptExplorer: Symbol.for("ScriptExplorerView"),
        changedScripts: Symbol.for("ChangedScriptView")
    },
    command: Symbol.for("Command"),
    startup: Symbol.for("Startup"),
    extensionContext: Symbol.for("ExtensionContext")
};

export default TYPES;
