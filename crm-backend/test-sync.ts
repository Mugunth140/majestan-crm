import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ContactLogsService } from './src/modules/contact-logs/contact-logs.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ContactLogsService);
  
  const res = await service.syncCallLogs(2, [{
    sourceCallId: "development-device:1",
    phoneNumber: "9994032320",
    direction: "Incoming",
    duration: 18,
    timestamp: new Date().toISOString()
  }]);
  
  console.log("SYNC RES:", res);
  process.exit(0);
}
bootstrap();
