import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { LotStatus, Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly biddingGateway: BiddingGateway,
  ) {}

  async getShowcaseLots(search?: string, statusFilter?: LotStatus) {
    await this.syncLotLifecycle();

    return this.prisma.lot.findMany({
      where: {
        status: statusFilter
          ? statusFilter === LotStatus.CANCELLED
            ? undefined
            : statusFilter
          : { not: LotStatus.CANCELLED },
        ...(search
          ? {
              title: { contains: search, mode: 'insensitive' },
            }
          : {}),
      },
      include: {
        auctioneer: { select: { name: true, publicAlias: true } },
        winner: { select: { id: true, publicAlias: true } },
        _count: { select: { bids: true } },
      },
      orderBy: { endsAt: 'asc' },
    });
  }

  async getLotRoomDetails(lotId: string) {
    await this.syncLotLifecycle();

    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        auctioneer: { select: { id: true, publicAlias: true } },
        winner: { select: { id: true, publicAlias: true } },
        receipt: true,
        bids: {
          orderBy: { sequenceNumber: 'desc' },
          include: {
            bidder: { select: { id: true, publicAlias: true } },
          },
        },
      },
    });

    if (!lot) throw new NotFoundException('Lote não encontrado.');

    return {
      ...lot,
      bids: lot.bids.map((b) => ({
        id: b.id,
        sequenceNumber: b.sequenceNumber,
        amount: b.amount,
        createdAt: b.createdAt,
        bidderId: b.bidder.id,
        bidderAlias: b.bidder.publicAlias,
      })),
    };
  }

  async getAuctioneerDashboard(auctioneerId: string) {
    await this.syncLotLifecycle();

    const lots = await this.prisma.lot.findMany({
      where: { auctioneerId },
      include: {
        winner: { select: { publicAlias: true } },
        receipt: true,
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReceivedInCents = lots
      .filter((l) => l.status === LotStatus.FINISHED)
      .reduce((acc, l) => acc + l.currentPrice, 0);

    return {
      totalReceivedInCents,
      totalLots: lots.length,
      lots,
    };
  }

  async createLot(
    auctioneerId: string,
    dto: {
      externalItemId: string;
      title: string;
      description?: string;
      imageUrl: string;
      attributesJson: Record<string, any>;
      startingPriceInCents: number;
      minIncrementInCents: number;
      startsAt: string;
      endsAt: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: auctioneerId } });
    if (!user || user.role !== Role.AUCTIONEER) {
      throw new ForbiddenException('Apenas leiloeiros podem criar lotes.');
    }

    const startsAtDate = new Date(dto.startsAt);
    const endsAtDate = new Date(dto.endsAt);
    const now = new Date();

    if (endsAtDate <= startsAtDate) {
      throw new BadRequestException('A data de término deve ser posterior à data de início.');
    }

    const initialStatus =
      startsAtDate <= now ? LotStatus.ACTIVE : LotStatus.SCHEDULED;

    return this.prisma.lot.create({
      data: {
        auctioneerId,
        externalItemId: dto.externalItemId,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        attributesJson: dto.attributesJson,
        startingPrice: dto.startingPriceInCents,
        minIncrement: dto.minIncrementInCents,
        currentPrice: 0,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        status: initialStatus,
      },
    });
  }

  async cancelLot(lotId: string, auctioneerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE`;

      const lot = await tx.lot.findUnique({ where: { id: lotId } });
      if (!lot) throw new NotFoundException('Lote não encontrado.');

      if (lot.auctioneerId !== auctioneerId) {
        throw new ForbiddenException('Só pode cancelar os seus próprios lotes.');
      }

      if (
        lot.status === LotStatus.FINISHED ||
        lot.status === LotStatus.UNSOLD ||
        lot.status === LotStatus.CANCELLED
      ) {
        throw new BadRequestException('Este lote já foi encerrado ou cancelado.');
      }

      if (lot.winnerId && lot.currentPrice > 0) {
        await tx.user.update({
          where: { id: lot.winnerId },
          data: {
            committedBalance: { decrement: lot.currentPrice },
          },
        });
      }

      const cancelledLot = await tx.lot.update({
        where: { id: lotId },
        data: {
          status: LotStatus.CANCELLED,
          winnerId: null,
        },
      });

      this.biddingGateway.broadcastLotStatusChange(lotId, {
        status: LotStatus.CANCELLED,
        message: 'Lote cancelado pelo leiloeiro. Os saldos comprometidos foram estornados.',
      });

      return cancelledLot;
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async syncLotLifecycle() {
    const now = new Date();

    await this.prisma.lot.updateMany({
      where: {
        status: LotStatus.SCHEDULED,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      data: { status: LotStatus.ACTIVE },
    });

    const expiredLots = await this.prisma.lot.findMany({
      where: {
        status: { in: [LotStatus.ACTIVE, LotStatus.SCHEDULED] },
        endsAt: { lte: now },
      },
    });

    for (const expiredLot of expiredLots) {
      await this.settleExpiredLot(expiredLot.id);
    }
  }

  private async settleExpiredLot(lotId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE`;

      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        include: {
          bids: { orderBy: { sequenceNumber: 'desc' }, take: 1 },
        },
      });

      if (
        !lot ||
        lot.status === LotStatus.FINISHED ||
        lot.status === LotStatus.UNSOLD ||
        lot.status === LotStatus.CANCELLED
      ) {
        return;
      }

      const winningBid = lot.bids[0];

      if (!winningBid || !lot.winnerId) {
        await tx.lot.update({
          where: { id: lot.id },
          data: { status: LotStatus.UNSOLD },
        });

        this.biddingGateway.broadcastLotStatusChange(lot.id, {
          status: LotStatus.UNSOLD,
        });
        return;
      }

      await tx.user.update({
        where: { id: lot.winnerId },
        data: {
          totalBalance: { decrement: winningBid.amount },
          committedBalance: { decrement: winningBid.amount },
        },
      });

      await tx.user.update({
        where: { id: lot.auctioneerId },
        data: {
          totalBalance: { increment: winningBid.amount },
        },
      });

      const verificationHash = crypto
        .createHash('sha256')
        .update(`RECEIPT:${lot.id}:${lot.winnerId}:${winningBid.amount}:${winningBid.bidHash}`)
        .digest('hex');

      const receipt = await tx.receipt.create({
        data: {
          lotId: lot.id,
          finalAmount: winningBid.amount,
          verificationHash,
        },
      });

      await tx.lot.update({
        where: { id: lot.id },
        data: { status: LotStatus.FINISHED },
      });

      this.biddingGateway.broadcastLotStatusChange(lot.id, {
        status: LotStatus.FINISHED,
        winnerId: lot.winnerId,
        finalAmount: winningBid.amount,
        receiptId: receipt.id,
      });
    });
  }
}