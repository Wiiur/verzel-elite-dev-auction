import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LotsService } from './lots.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LotStatus } from '@prisma/client';

class CreateLotDto {
  @IsString()
  @IsNotEmpty()
  externalItemId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsObject()
  attributesJson: Record<string, any>;

  @IsInt()
  @Min(100)
  startingPriceInCents: number;

  @IsInt()
  @Min(100)
  minIncrementInCents: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  getShowcase(
    @Query('search') search?: string,
    @Query('status') status?: LotStatus,
  ) {
    return this.lotsService.getShowcaseLots(search, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auctioneer/my-lots')
  getAuctioneerLots(@CurrentUser() user: JwtUserPayload) {
    return this.lotsService.getAuctioneerDashboard(user.userId);
  }

  @Get(':id')
  getLotDetail(@Param('id') id: string) {
    return this.lotsService.getLotRoomDetails(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createLot(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateLotDto) {
    return this.lotsService.createLot(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancelLot(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.lotsService.cancelLot(id, user.userId);
  }
}