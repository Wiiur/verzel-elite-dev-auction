import { Module } from '@nestjs/common';
import { LotsService } from './lots.service';
import { LotsController } from './lots.controller';
import { BiddingModule } from '../bidding/bidding.module';
import { HashChainService } from '../../common/crypto/hash-chain.service';

@Module({
  imports: [BiddingModule],
  controllers: [LotsController],
  providers: [LotsService, HashChainService],
})
export class LotsModule {}