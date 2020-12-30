import 'reflect-metadata';

import { CommandService } from './services/command/CommandService';
import { ConfigService } from './services/config/configService';
import { ConnectionService } from './services/connection/connectionService';
import { Container } from 'inversify';
import { DownloadAllCommand } from './commands/downloadAllCommand';
import { FileService } from './services/file/FileService';
import { ICommand } from './commands/ICommand';
import { ICommandService } from './services/command/ICommandService';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import { IFileService } from './services/file/IFileService';
import { IStartup } from './IStartup';
import { Startup } from './Startup';
import TYPES from './Types';

const container = new Container();

container.bind<IStartup>(TYPES.startup).to(Startup).inSingletonScope();

container.bind<IConfigService>(TYPES.services.config).to(ConfigService).inSingletonScope();
container.bind<IConnectionService>(TYPES.services.connection).to(ConnectionService).inSingletonScope();
container.bind<IFileService>(TYPES.services.file).to(FileService).inSingletonScope();
container.bind<ICommandService>(TYPES.services.command).to(CommandService).inSingletonScope();

container.bind<ICommand>(TYPES.command).to(DownloadAllCommand).inSingletonScope();

export default container;