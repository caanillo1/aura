import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Aumentar límite de body para soportar logos en base64
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });
  const logger = new Logger('Bootstrap');

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // CORS
  const rawOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'];
  for (const o of rawOrigins) {
    if (!/^https?:\/\//.test(o.trim())) {
      throw new Error(`ALLOWED_ORIGINS: "${o.trim()}" le falta el protocolo (https://). Corrige el .env y reinicia.`);
    }
  }
  app.enableCors({ origin: rawOrigins.map((o) => o.trim()), credentials: true });

  // Filtro global de errores de Prisma
  app.useGlobalFilters(new PrismaExceptionFilter());

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
