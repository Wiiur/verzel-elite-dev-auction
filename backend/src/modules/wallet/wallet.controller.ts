import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { IsInt, Min } from 'class-validator';

class DepositDto {
  @IsInt({ message: 'O valor deve ser enviado em cêntimos (inteiro).' })
  @Min(100, { message: 'O depósito mínimo é de R$ 1,00 (100 cêntimos).' })
  amountInCents: number;
}

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: JwtUserPayload) {
    return this.walletService.getWalletSummary(user.userId);
  }

  @Post('deposit')
  deposit(@CurrentUser() user: JwtUserPayload, @Body() dto: DepositDto) {
    return this.walletService.simulateDeposit(user.userId, dto.amountInCents);
  }

  @Get('my-auctions')
  getMyAuctions(@CurrentUser() user: JwtUserPayload) {
    return this.walletService.getMyBidsAndWins(user.userId);
  }
}