import 'reflect-metadata';

import { ConfigService } from './services/config/configService';
import { ConnectionService } from './services/connection/connectionService';
import { Container } from 'inversify';
import { FileService } from './services/file/FileService';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import { IFileService } from './services/file/IFileService';
import TYPES from './types';

const container = new Container();

container.bind<IConfigService>(TYPES.services.config).to(ConfigService);
container.bind<IConnectionService>(TYPES.services.connection).to(ConnectionService);
container.bind<IFileService>(TYPES.services.file).to(FileService);

export default container;