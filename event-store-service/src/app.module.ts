import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventStoreController } from './controllers/event-store.controller';
import { EventStoreService } from './services/event-store.service';
import { PostgreSQLEventStoreRepository } from './infrastructure/postgresql-event-store.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [EventStoreController],
  providers: [
    PostgreSQLEventStoreRepository,
    {
      provide: 'EventStoreRepository',
      useClass: PostgreSQLEventStoreRepository,
    },
    EventStoreService,
  ],
})
export class AppModule {}
