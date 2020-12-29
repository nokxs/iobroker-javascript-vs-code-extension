import 'reflect-metadata';

import { CommandService } from './services/command/CommandService';
import { ConfigService } from './services/config/configService';
import { ConnectionService } from './services/connection/connectionService';
import { Container } from 'inversify';
import { FileService } from './services/file/FileService';
import { ICommandService } from './services/command/ICommandService';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import { IFileService } from './services/file/IFileService';
import TYPES from './types';

const container = new Container();

container.bind<IConfigService>(TYPES.services.config).to(ConfigService);
container.bind<IConnectionService>(TYPES.services.connection).to(ConnectionService);
container.bind<IFileService>(TYPES.services.file).to(FileService);
container.bind<ICommandService>(TYPES.services.command).to(CommandService);

export default container;