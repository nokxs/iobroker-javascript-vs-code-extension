import 'reflect-metadata';

import { ConfigService } from './services/config/configService';
import { Container } from 'inversify';
import { IConfigService } from './services/config/IConfigService';
import TYPES from './types';

const container = new Container();

container.bind<IConfigService>(TYPES.services.config).to(ConfigService);

export default container;