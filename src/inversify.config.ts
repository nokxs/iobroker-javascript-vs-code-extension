import 'reflect-metadata';

import { ConfigService } from './services/config/configService';
import { ConnectionService } from './services/connection/connectionService';
import { Container } from 'inversify';
import { IConfigService } from './services/config/IConfigService';
import { IConnectionService } from './services/connection/IConnectionService';
import TYPES from './types';

const container = new Container();

container.bind<IConfigService>(TYPES.services.config).to(ConfigService);
container.bind<IConnectionService>(TYPES.services.connection).to(ConnectionService);

export default container;