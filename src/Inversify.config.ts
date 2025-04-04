import 'reflect-metadata';

import { DownloadCommand, DownloadCommandProxy } from './commands/DownloadCommand';
import { UploadCommand, UploadCommandProxy } from './commands/UploadCommand';

import { AdminVersionDetector } from './services/adminVersionDetector/AdminVersionDetector';
import { AutoUploadService } from './services/autoUpload/AutoUploadService';
import { ChangeJsInstanceCommand } from './commands/ChangeJsInstanceCommand';
import { ChangedScriptsProvider } from './views/changedScripts/ChangedScriptsProvider';
import { CommandService } from './services/command/CommandService';
import { ConfigCreationService } from './services/configCreation/ConfigCreationService';
import { ConfigRepositoryService } from './services/configRepository/ConfigRepositoryService';
import { ConnectCommand } from './commands/ConnectCommand';
import { ConnectionServiceAdmin4 } from './services/connection/ConnectionServiceAdmin4';
import { ConnectionServiceAdmin5 } from './services/connection/ConnectionServiceAdmin5';
import { ConnectionServiceProvider } from './services/connectionServiceProvider/ConnectionServiceProvider';
import { Container } from 'inversify';
import { CreateDirectoryCommand } from './commands/CreateDirectoryCommand';
import { CreateDirectoryInRootCommand } from './commands/CreateDirectoryInRootCommand';
import { CreateJavaScriptFileCommand } from './commands/CreateJavaScriptFileCommand';
import { CreateScriptFileCommand } from './commands/CreateScriptFileCommand';
import { CreateTypeScriptFileCommandy } from './commands/CreateTypeScriptFileCommandy';
import { DebugLogService } from './services/debugLogService/DebugLogService';
import { DeleteDirectoryCommand } from './commands/DeleteDirectoryCommand';
import { DeleteScriptCommand } from './commands/DeleteScriptCommand';
import { DirectoryService } from './services/directory/DirectorytService';
import { DownloadAllCommand } from './commands/DownloadAllCommand';
import { FileService } from './services/file/FileService';
import { IAdminVersionDetector } from './services/adminVersionDetector/IAdminVersionDetector';
import { IAutoUploadService } from './services/autoUpload/IAutoUploadService';
import { IChangedScriptsProvider } from './views/changedScripts/IChangedScriptsProvider';
import { ICommand } from './commands/ICommand';
import { ICommandService } from './services/command/ICommandService';
import { IConfigCreationService } from './services/configCreation/IConfigCreationService';
import { IConfigRepositoryService } from './services/configRepository/IConfigRepositoryService';
import { IConnectionServiceProvider } from './services/connectionServiceProvider/IConnectionServiceProvider';
import { IDebugLogService } from './services/debugLogService/IDebugLogService';
import { IDirectoryService } from './services/directory/IDirectoryService';
import { IFileService } from './services/file/IFileService';
import { IIobrokerCompletionItemProvider } from './providers/IIobrokerCompletionItemProvider';
import { IIobrokerConnectionService } from './services/iobrokerConnection/IIobrokerConnectionService';
import { IIobrokerHoverProvider } from './providers/IIobrokerHoverProvider';
import { IJsInstanceService } from './services/jsInstanceService/IJsInstanceService';
import { ILocalOnlyScriptRepositoryService } from './services/localOnlyScriptRepository/ILocalOnlyScriptRepositoryService';
import { ILogService } from './services/log/ILogService';
import { ILoginCredentialsService } from './services/loginCredentialsService/ILoginCredentialsService';
import { ILoginService } from './services/loginHttpClient/ILoginService';
import { IObjectRepositoryService } from './services/StateRepository/IObjectRepositoryService';
import { IScriptCreationService } from './services/scriptCreation/IScriptCreationService';
import { IScriptExplorerProvider } from './views/scriptExplorer/IScriptExplorerProvider';
import { IScriptIdService } from './services/scriptId/IScriptIdService';
import { IScriptRemoteService } from './services/scriptRemote/IScriptRemoteService';
import { IScriptRepositoryService } from './services/scriptRepository/IScriptRepositoryService';
import { IScriptService } from './services/script/IScriptService';
import { ISocketIoClient } from './services/socketIoClient/ISocketIoClient';
import { IStartup } from './IStartup';
import { IStateAndObjectRemoteService } from './services/stateRemote/IStateAndObjectRemoteService';
import { IStatusBarService } from './services/statusBar/IStatusBarService';
import { ITypeDefinitionService } from './services/typeDefinition/ITypeDefinitionService';
import { IWindowMessageService } from './services/windowMessage/IWindowMessageService';
import { IWorkspaceService } from './services/workspace/IWorkspaceService';
import { IoBrokerCompletionItemProvider } from './providers/IoBrokerCompletionItemProvider';
import { IoBrokerHoverProvider } from './providers/IoBrokerHoverProvider';
import { IobrokerConnectionService } from './services/iobrokerConnection/IobrokerConnectionService';
import { JsInstanceService } from './services/jsInstanceService/JsInstanceService';
import { LocalOnlyScriptRepositoryService } from './services/localOnlyScriptRepository/LocalOnlyScriptRepositoryService';
import { LogService } from './services/log/LogService';
import { LoginCredentialsService } from './services/loginCredentialsService/LoginCredentialsService';
import { LoginService } from './services/loginHttpClient/LoginService';
import { LogoutCommand } from './commands/LogoutCommand';
import { MoveCommand } from './commands/MoveCommand';
import { ObjectRepositoryService } from './services/StateRepository/ObjectRepositoryService';
import { OpenFileCommand } from './commands/OpenFileCommand';
import { RefreshCommand } from './commands/RefreshCommand';
import { ScriptCreationService } from './services/scriptCreation/ScriptCreationService';
import { ScriptExplorerProvider } from './views/scriptExplorer/ScriptExplorerProvider';
import { ScriptIdService } from './services/scriptId/ScriptIdService';
import { ScriptRemoteService } from './services/scriptRemote/ScriptRemoteService';
import { ScriptRenameCommand } from './commands/ScriptRenameCommand';
import { ScriptRepositoryService } from './services/scriptRepository/ScriptRepositoryService';
import { ScriptService } from './services/script/ScriptService';
import { ShowLocalToServerDiffCommand } from './commands/ShowLocalToServerDiffCommand';
import { SocketIoClient } from './services/socketIoClient/SocketIoClient';
import { StartCurrentScriptCommand } from './commands/StartCurrentScriptCommand';
import { StartStopCollectingDebugLog } from './commands/StartStopCollectingDebugLog';
import { Startup } from './Startup';
import { StateAndObjectRemoteService } from './services/stateRemote/StateAndObjectRemoteService';
import { StatusBarService } from './services/statusBar/StatusBarService';
import { StopCurrentScriptCommand } from './commands/StopCurrentScriptCommand';
import TYPES from './Types';
import { TypeDefinitionService } from './services/typeDefinition/TypeDefinitionService';
import { UpdateTypeDefinitionCommand } from './commands/UpdateTypeDefinitionCommand';
import { UploadAllCommand } from './commands/UploadAllCommand';
import { WindowMessageService } from './services/windowMessage/WindowMessageService';
import { WorkspaceService } from './services/workspace/WorkspaceService';
import { IobrokerCodeActionItemProvider } from './providers/IoBrokerCodeActionsProvider';

const container = new Container();

container.bind<IStartup>(TYPES.startup).to(Startup).inSingletonScope();

container.bind<IWorkspaceService>(TYPES.services.workspace).to(WorkspaceService).inSingletonScope();
container.bind<IConfigCreationService>(TYPES.services.configCreation).to(ConfigCreationService).inSingletonScope();
container.bind<IFileService>(TYPES.services.file).to(FileService).inSingletonScope();
container.bind<ICommandService>(TYPES.services.command).to(CommandService).inSingletonScope();
container.bind<IScriptService>(TYPES.services.script).to(ScriptService).inSingletonScope();
container.bind<IScriptIdService>(TYPES.services.scriptId).to(ScriptIdService).inSingletonScope();
container.bind<IScriptRemoteService>(TYPES.services.scriptRemote).to(ScriptRemoteService).inSingletonScope();
container.bind<IScriptRepositoryService>(TYPES.services.scriptRepository).to(ScriptRepositoryService).inSingletonScope();
container.bind<ILocalOnlyScriptRepositoryService>(TYPES.services.localOnlyScriptRepository).to(LocalOnlyScriptRepositoryService).inSingletonScope();
container.bind<IDirectoryService>(TYPES.services.directory).to(DirectoryService).inSingletonScope();
container.bind<ILogService>(TYPES.services.log).to(LogService).inSingletonScope();
container.bind<ITypeDefinitionService>(TYPES.services.typeDefinition).to(TypeDefinitionService).inSingletonScope();
container.bind<IIobrokerConnectionService>(TYPES.services.iobrokerConnection).to(IobrokerConnectionService).inSingletonScope();
container.bind<IConfigRepositoryService>(TYPES.services.configRepository).to(ConfigRepositoryService).inSingletonScope();
container.bind<IJsInstanceService>(TYPES.services.jsInstance).to(JsInstanceService).inSingletonScope();
container.bind<IConnectionServiceProvider>(TYPES.services.connectionServiceProvider).to(ConnectionServiceProvider).inSingletonScope();
container.bind<ILoginService>(TYPES.services.login).to(LoginService).inSingletonScope();
container.bind<ILoginCredentialsService>(TYPES.services.loginCredentials).to(LoginCredentialsService).inSingletonScope();
container.bind<IDebugLogService>(TYPES.services.debugLogService).to(DebugLogService).inSingletonScope();
container.bind<IStatusBarService>(TYPES.services.statusBarService).to(StatusBarService).inSingletonScope();
container.bind<IWindowMessageService>(TYPES.services.windowMessageService).to(WindowMessageService).inSingletonScope();
container.bind<IStateAndObjectRemoteService>(TYPES.services.stateAndObjectRemoteService).to(StateAndObjectRemoteService).inSingletonScope();
container.bind<IObjectRepositoryService>(TYPES.services.objectRepositoryService).to(ObjectRepositoryService).inSingletonScope();
container.bind<IAutoUploadService>(TYPES.services.autoUploadService).to(AutoUploadService).inSingletonScope();
container.bind<IScriptCreationService>(TYPES.services.scriptCreationService).to(ScriptCreationService).inSingletonScope();

container.bind<ISocketIoClient>(TYPES.services.socketIoClient).to(SocketIoClient).inSingletonScope();
container.bind<IAdminVersionDetector>(TYPES.services.adminVersionDetector).to(AdminVersionDetector).inSingletonScope();

container.bind<IIobrokerHoverProvider>(TYPES.providers.iobrokerHoverProvider).to(IoBrokerHoverProvider).inSingletonScope();
container.bind<IIobrokerCompletionItemProvider>(TYPES.providers.iobrokerCompletionItemProvider).to(IoBrokerCompletionItemProvider).inSingletonScope();
container.bind<IobrokerCodeActionItemProvider>(TYPES.providers.iobrokerCodeActionsItemProvider).to(IobrokerCodeActionItemProvider).inSingletonScope();

container.bind(TYPES.services.connectionAdmin4).to(ConnectionServiceAdmin4).inSingletonScope();
container.bind(TYPES.services.connectionAdmin5).to(ConnectionServiceAdmin5).inSingletonScope();

container.bind<ICommand>(TYPES.command).to(StartStopCollectingDebugLog);
container.bind<ICommand>(TYPES.command).to(DownloadAllCommand);
container.bind<ICommand>(TYPES.command).to(DownloadCommand);
container.bind<ICommand>(TYPES.command).to(DownloadCommandProxy);
container.bind<ICommand>(TYPES.command).to(UploadCommand);
container.bind<ICommand>(TYPES.command).to(UploadCommandProxy);
container.bind<ICommand>(TYPES.command).to(UploadAllCommand);
container.bind<ICommand>(TYPES.command).to(StartCurrentScriptCommand);
container.bind<ICommand>(TYPES.command).to(StopCurrentScriptCommand);
container.bind<ICommand>(TYPES.command).to(UpdateTypeDefinitionCommand);
container.bind<ICommand>(TYPES.command).to(OpenFileCommand);
container.bind<ICommand>(TYPES.command).to(ConnectCommand);
container.bind<ICommand>(TYPES.command).to(LogoutCommand);
container.bind<ICommand>(TYPES.command).to(ScriptRenameCommand);
container.bind<ICommand>(TYPES.command).to(ChangeJsInstanceCommand);
container.bind<ICommand>(TYPES.command).to(MoveCommand);
container.bind<ICommand>(TYPES.command).to(DeleteScriptCommand);
container.bind<ICommand>(TYPES.command).to(DeleteDirectoryCommand);
container.bind<ICommand>(TYPES.command).to(RefreshCommand);
container.bind<ICommand>(TYPES.command).to(CreateDirectoryCommand);
container.bind<ICommand>(TYPES.command).to(CreateDirectoryInRootCommand);
container.bind<ICommand>(TYPES.command).to(CreateTypeScriptFileCommandy);
container.bind<ICommand>(TYPES.command).to(CreateJavaScriptFileCommand);
container.bind<ICommand>(TYPES.command).to(CreateScriptFileCommand);
container.bind<ICommand>(TYPES.command).to(ShowLocalToServerDiffCommand);

container.bind<IScriptExplorerProvider>(TYPES.views.scriptExplorer).to(ScriptExplorerProvider).inSingletonScope();
container.bind<IChangedScriptsProvider>(TYPES.views.changedScripts).to(ChangedScriptsProvider).inSingletonScope();

export default container;
