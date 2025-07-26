import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CommandsController } from './controllers/commands.controller';
import { AuthController } from './controllers/auth.controller';
import { CommandStatusController } from './controllers/command-status.controller';
import { AccountCommandService } from './services/account-command.service';
import { AuthService } from './services/auth.service';
import { PostgreSQLEventStore, AccountRepository, EventStore } from './infrastructure/event-store';
import { RabbitMQEventPublisher } from './infrastructure/rabbitmq-event-publisher';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    CommandsController,
    AuthController,
    CommandStatusController
  ],
  providers: [
    AccountCommandService,
    AuthService,
    PostgreSQLEventStore,
    {
      provide: 'EventStore',
      useClass: PostgreSQLEventStore,
    },
    AccountRepository,
    RabbitMQEventPublisher,
    JwtAuthGuard,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private eventPublisher: RabbitMQEventPublisher) {}

  async onModuleInit() {
    // Initialize RabbitMQ connection when the module starts
    await this.eventPublisher.connect();
  }
}
