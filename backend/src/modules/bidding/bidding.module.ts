import { Module } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';
import { BiddingGateway } from './bidding.gateway';

@Module({
  controllers: [BiddingController],
  providers: [BiddingService, BiddingGateway],
  exports: [BiddingGateway, BiddingService],
})
export class BiddingModule {}