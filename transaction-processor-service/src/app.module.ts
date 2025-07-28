import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransferEventConsumer } from './consumers/transfer-event.consumer';
import { EventStoreClient } from './clients/event-store.client';
import { SagaDatabaseClient } from './clients/saga-database.client';
import { TransferProcessorService } from './services/transfer-processor.service';
import { SagaOrchestratorService } from './services/saga-orchestrator.service';
import { RabbitMQPublisher } from './infrastructure/rabbitmq-publisher';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TransferEventConsumer,
    EventStoreClient,
    SagaDatabaseClient,
    TransferProcessorService,
    SagaOrchestratorService,
    RabbitMQPublisher,
  ],
})
export class AppModule {}
