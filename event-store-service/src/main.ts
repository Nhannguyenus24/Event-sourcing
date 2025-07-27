import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  app.enableCors();
  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Event Store Service API')
    .setDescription('Event Sourcing Event Store Service - Manages event persistence, snapshots, and event replay functionality')
    .setVersion('1.0')
    .addTag('Event Store', 'Event storage and retrieval operations')
    .addTag('Snapshots', 'Aggregate snapshot management')
    .addTag('Event Replay', 'Event replay and projection rebuilding')
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

  const port = 3002;
  await app.listen(port);
  
  console.log(`Event Store Service is running on port ${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
