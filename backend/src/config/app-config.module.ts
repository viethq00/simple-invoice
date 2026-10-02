import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock';
import { AppConfig } from './app-config';

@Global()
@Module({
  providers: [
    AppConfig,
    {
      provide: Clock,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Clock => new SystemClock(config.timezone),
    },
  ],
  exports: [AppConfig, Clock],
})
export class AppConfigModule {}
