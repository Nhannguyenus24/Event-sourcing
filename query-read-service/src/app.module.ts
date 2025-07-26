import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueryController } from './controllers/query.controller';
import { QueryService } from './services/query.service';
import { EventConsumerService } from './services/event-consumer.service';
import { ReadModelRepository } from './infrastructure/read-model-repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [QueryController],
  providers: [
    QueryService,
    EventConsumerService,
    ReadModelRepository,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private eventConsumerService: EventConsumerService) {}

  async onModuleInit() {
    // Start consuming events from RabbitMQ
    await this.eventConsumerService.startEventConsumer();
    console.log('Query Read Service initialized with event consumer');
  }
}
