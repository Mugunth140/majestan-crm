import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { assertRequiredEnv } from './env.validation';

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule);

  // Browser calls are same-origin via the Next.js rewrite; FRONTEND_URL covers
  // any direct cross-origin use (e.g. local dev on a different port).
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`CRM Backend running on port ${port}`);
}
bootstrap();
