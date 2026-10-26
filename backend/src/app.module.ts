import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CatalogApiModule } from './modules/catalog-api/catalog-api.module';
import { LotsModule } from './modules/lots/lots.module';
import { BiddingModule } from './modules/bidding/bidding.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    AuthModule,
    WalletModule,
    CatalogApiModule,
    LotsModule,
    BiddingModule,
    AuditModule,
  ],
})
export class AppModule {}