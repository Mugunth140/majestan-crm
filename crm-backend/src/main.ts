import { hrImportJsonParser } from './common/middleware/hr-import-json';
import { mailJsonParser } from './common/middleware/mail-json';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { assertRequiredEnv } from './env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';


async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Allow the validated 500-row HR import without changing other JSON limits.
  app.use('/api/v1/hr/bulk', hrImportJsonParser);
  // Email bodies and templates from the composer (attachments use multipart, not JSON).
  app.use('/api/v1/mail', mailJsonParser);

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

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`CRM Backend running on port ${port}`);
}
bootstrap();
