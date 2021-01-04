import 'reflect-metadata';

import { CommandService } from './services/command/CommandService';
import { ConfigService } from './services/config/configService';
import { ConnectionService } from './services/connection/connectionService';
import { Container } from 'inversify';
import { DownloadAllCommand } from './commands/downloadAllCommand';
import { DownloadCommand } from './commands/DownloadCommand';
import { FileService } from './services/file/FileService';
import { ICommand } from './commands/ICommand';
import { ICommandService } from './services/command/ICommandService';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import { IFileService } from './services/file/IFileService';
import { ILogService } from "./services/log/ILogService";
import { IScriptExplorerProvider } from "./views/scriptExplorer/IScriptExplorerProvider";
import { IScriptService } from './services/script/IScriptService';
import { IStartup } from './IStartup';
import { ITypeDefinitionService } from "./services/typeDefinition/ITypeDefinitionService";
import { IWorkspaceService } from './services/workspace/IWorkspaceService';
import { LogService } from './services/log/LogService';
import { OpenFileCommand } from './commands/OpenFileCommand';
import { ScriptExplorerProvider } from './views/scriptExplorer/ScriptExplorerProvider';
import { ScriptItem } from "./views/scriptExplorer/ScriptItem";
import { ScriptService } from './services/script/ScriptService';
import { StartCurrentScriptCommand } from './commands/StartCurrentScriptCommand';
import { Startup } from './Startup';
import { StopCurrentScriptCommand } from './commands/StopCurrentScriptCommand';
import TYPES from './Types';
import { TypeDefinitionService } from './services/typeDefinition/TypeDefinitionService';
import { UpdateTypeDefinitionCommand } from './commands/UpdateTypeDefinitionCommand';
import { UploadAllCommand } from './commands/UploadAllCommand';
import { UploadCurrentCommand } from './commands/UploadCurrentCommand';
import { WorkspaceService } from './services/workspace/WorkspaceService';

const container = new Container();

container.bind<IStartup>(TYPES.startup).to(Startup).inSingletonScope();

container.bind<IWorkspaceService>(TYPES.services.workspace).to(WorkspaceService).inSingletonScope();
container.bind<IConfigService>(TYPES.services.config).to(ConfigService).inSingletonScope();
container.bind<IConnectionService>(TYPES.services.connection).to(ConnectionService).inSingletonScope();
container.bind<IFileService>(TYPES.services.file).to(FileService).inSingletonScope();
container.bind<ICommandService>(TYPES.services.command).to(CommandService).inSingletonScope();
container.bind<IScriptService>(TYPES.services.script).to(ScriptService).inSingletonScope();
container.bind<ILogService>(TYPES.services.log).to(LogService).inSingletonScope();
container.bind<ITypeDefinitionService>(TYPES.services.typeDefinition).to(TypeDefinitionService).inSingletonScope();

container.bind<ICommand>(TYPES.command).to(DownloadAllCommand);
container.bind<ICommand>(TYPES.command).to(DownloadCommand);
container.bind<ICommand>(TYPES.command).to(UploadAllCommand);
container.bind<ICommand>(TYPES.command).to(UploadCurrentCommand);
container.bind<ICommand>(TYPES.command).to(StartCurrentScriptCommand);
container.bind<ICommand>(TYPES.command).to(StopCurrentScriptCommand);
container.bind<ICommand>(TYPES.command).to(UpdateTypeDefinitionCommand);
container.bind<ICommand>(TYPES.command).to(OpenFileCommand);

container.bind<IScriptExplorerProvider>(TYPES.views.scriptExplorer).to(ScriptExplorerProvider);

export default container;