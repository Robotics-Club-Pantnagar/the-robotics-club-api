import { Module } from '@nestjs/common';
import { CollegesController } from './colleges.controller';
import { CollegesService } from './colleges.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CollegesController],
  providers: [CollegesService],
  exports: [CollegesService],
})
export class CollegesModule {}
