import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env.staging si NODE_ENV=staging, de lo contrario .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aumentar límite de body para soportar logos en base64
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));
  const logger = new Logger('Bootstrap');

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('AURA ERP API')
    .setDescription('API REST del ERP de Implementaciones Hospitalarias – Sistemas Infotec')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Necesario para que Prisma se desconecte limpiamente en hot-reload
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`AURA Backend corriendo en: http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs en:           http://localhost:${port}/api/docs`);
}
bootstrap();
