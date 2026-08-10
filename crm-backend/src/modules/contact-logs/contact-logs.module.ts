import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactLogsService } from './contact-logs.service';
import { ContactLogsController } from './contact-logs.controller';
import { User } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
  ],
  controllers: [ContactLogsController],
  providers: [ContactLogsService],
})
export class ContactLogsModule {}
