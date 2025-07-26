import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS
  app.enableCors();

  // Add global prefix
  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Query/Read Service API')
    .setDescription('Event Sourcing Query/Read Service - Provides optimized read operations, account balances, transaction history, and real-time projections')
    .setVersion('1.0')
    .addTag('Accounts', 'Account read operations and balance queries')
    .addTag('Transactions', 'Transaction history and filtering')
    .addTag('Statements', 'Account statements and reports')
    .addTag('Analytics', 'Account analytics and insights')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`Query Read Service is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
