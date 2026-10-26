import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { IsInt, Min } from 'class-validator';

class PlaceBidDto {
  @IsInt({ message: 'O valor do lance deve ser enviado em cêntimos (inteiro).' })
  @Min(1, { message: 'O valor do lance deve ser positivo.' })
  amountInCents: number;
}

@UseGuards(JwtAuthGuard)
@Controller('lots/:lotId/bids')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  @Post()
  placeBid(
    @Param('lotId') lotId: string,
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: PlaceBidDto,
  ) {
    return this.biddingService.placeBid(lotId, user.userId, dto.amountInCents);
  }
}