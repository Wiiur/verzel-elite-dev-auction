import { Global, Module } from '@nestjs/common';
import { HashChainService } from './hash-chain.service';

@Global()
@Module({
  providers: [HashChainService],
  exports: [HashChainService],
})
export class CryptoModule {}