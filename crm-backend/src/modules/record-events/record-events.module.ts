import { Global, Module } from '@nestjs/common';
import { RecordEventsService } from './record-events.service';

/** Activity history for every module that has one; global so any module can record. */
@Global()
@Module({
  providers: [RecordEventsService],
  exports: [RecordEventsService],
})
export class RecordEventsModule {}
