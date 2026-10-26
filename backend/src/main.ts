import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permite conexão do Front-End
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Prefixo global para organizar todas as rotas REST em /api/...
  app.setGlobalPrefix('api');

  // Validação rigorosa de DTOs (barra campos intrusos e converte tipos automaticamente)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Back-End rodando em: http://localhost:${port}/api`);
}
bootstrap();