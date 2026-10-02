import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { buildLoggerOptions } from './common/logging/logger.options';
import { AppConfig } from './config/app-config';
import { AppConfigModule } from './config/app-config.module';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/data-source-options';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // backend/.env, then the repo-root .env. Real environment variables win.
      envFilePath: ['.env', '../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    AppConfigModule,
    LoggerModule.forRootAsync({ inject: [AppConfig], useFactory: buildLoggerOptions }),
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => buildDataSourceOptions(config.database),
    }),
    UsersModule,
    AuthModule,
    InvoicesModule,
    HealthModule,
  ],
})
export class AppModule {}
