import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashChainService } from '../../common/crypto/hash-chain.service';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { LotStatus, Role } from '@prisma/client';
import { CURATED_ARTWORKS_POOL } from './curated-lots.data';
import * as crypto from 'crypto';

@Injectable()
export class LotsService {
  private readonly logger = new Logger(LotsService.name);
  private isSyncing = false;
  private hasSanitizedImages = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly biddingGateway: BiddingGateway,
    private readonly hashChain: HashChainService,
  ) {}

  private toSafeImageUrl(url: string): string {
    if (url.startsWith('https://www.artic.edu/iiif/')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=jpg`;
    }
    return url;
  }

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
      orderBy:
        statusFilter === LotStatus.SCHEDULED
          ? { startsAt: 'asc' }
          : { endsAt: 'asc' },
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
    const user = await this.prisma.user.findUnique({
      where: { id: auctioneerId },
    });
    if (!user || user.role !== Role.AUCTIONEER) {
      throw new ForbiddenException('Apenas leiloeiros podem criar lotes.');
    }

    const startsAtDate = new Date(dto.startsAt);
    const endsAtDate = new Date(dto.endsAt);
    const now = new Date();

    if (endsAtDate <= startsAtDate) {
      throw new BadRequestException(
        'A data de término deve ser posterior à data de início.',
      );
    }

    const initialStatus =
      startsAtDate <= now ? LotStatus.ACTIVE : LotStatus.SCHEDULED;

    return this.prisma.lot.create({
      data: {
        auctioneerId,
        externalItemId: dto.externalItemId,
        title: dto.title,
        description: dto.description,
        imageUrl: this.toSafeImageUrl(dto.imageUrl),
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
        throw new BadRequestException(
          'Este lote já foi encerrado ou cancelado.',
        );
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
        message:
          'Lote cancelado pelo leiloeiro. Os saldos comprometidos foram estornados.',
      });

      return cancelledLot;
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async syncLotLifecycle() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const now = new Date();

      // Executa apenas 1 vez ao iniciar o servidor para corrigir imagens antigas salvas no banco
      if (!this.hasSanitizedImages) {
        await this.sanitizeDatabaseImagesOnce();
        this.hasSanitizedImages = true;
      }

      // 1. Liquida e encerra lotes cujo horário de término (endsAt) já passou
      const expiredLots = await this.prisma.lot.findMany({
        where: {
          status: { in: [LotStatus.ACTIVE, LotStatus.SCHEDULED] },
          endsAt: { lte: now },
        },
        select: { id: true },
      });

      for (const expired of expiredLots) {
        await this.settleExpiredLot(expired.id);
      }

      // 2. Promove lotes AGENDADOS cujo startsAt chegou para AO VIVO (ACTIVE)
      await this.activateDueScheduledLots(now);

      // 3. Mantém 3 lotes AO VIVO e 3 lotes AGENDADOS sincronizados com o término dos ativos
      await this.ensureAuctionPipeline(3, 3);
    } catch (error) {
      this.logger.error('Erro ao sincronizar ciclo de vida dos lotes:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async sanitizeDatabaseImagesOnce() {
    for (const art of CURATED_ARTWORKS_POOL) {
      await this.prisma.lot.updateMany({
        where: {
          externalItemId: art.externalItemId,
          imageUrl: { not: art.imageUrl },
        },
        data: { imageUrl: art.imageUrl },
      });
    }

    const blockedArticLots = await this.prisma.lot.findMany({
      where: { imageUrl: { startsWith: 'https://www.artic.edu/iiif/' } },
      select: { id: true, imageUrl: true },
    });

    for (const lot of blockedArticLots) {
      await this.prisma.lot.update({
        where: { id: lot.id },
        data: { imageUrl: this.toSafeImageUrl(lot.imageUrl) },
      });
    }
  }

  private async activateDueScheduledLots(now: Date) {
    const dueLots = await this.prisma.lot.findMany({
      where: {
        status: LotStatus.SCHEDULED,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: { _count: { select: { bids: true } } },
    });

    if (dueLots.length === 0) return;

    const bidders = await this.prisma.user.findMany({
      where: { role: Role.BIDDER },
    });

    for (const lot of dueLots) {
      await this.prisma.$transaction(async (tx) => {
        await tx.lot.update({
          where: { id: lot.id },
          data: { status: LotStatus.ACTIVE },
        });

        if (lot._count.bids === 0 && bidders.length >= 2) {
          await this.createInitialBids(
            tx,
            lot.id,
            lot.startingPrice,
            lot.minIncrement,
            bidders,
            now,
          );
        }

        this.biddingGateway.broadcastLotStatusChange(lot.id, {
          status: LotStatus.ACTIVE,
        });
      });
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
        .update(
          `RECEIPT:${lot.id}:${lot.winnerId}:${winningBid.amount}:${winningBid.bidHash}`,
        )
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

  private async ensureAuctionPipeline(
    minActiveCount: number,
    targetScheduledCount: number,
  ) {
    const [activeLots, scheduledLots] = await Promise.all([
      this.prisma.lot.findMany({
        where: { status: LotStatus.ACTIVE },
        orderBy: { endsAt: 'asc' },
        select: { externalItemId: true, endsAt: true },
      }),
      this.prisma.lot.findMany({
        where: { status: LotStatus.SCHEDULED },
        orderBy: { startsAt: 'asc' },
        select: { externalItemId: true, startsAt: true },
      }),
    ]);

    const missingActive = Math.max(0, minActiveCount - activeLots.length);
    const missingScheduled = Math.max(
      0,
      targetScheduledCount - scheduledLots.length,
    );
    const totalNeeded = missingActive + missingScheduled;

    if (totalNeeded === 0) return;

    const recentLots = await this.prisma.lot.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { externalItemId: true },
    });

    const excludedIds = new Set([
      ...activeLots.map((l) => l.externalItemId),
      ...scheduledLots.map((l) => l.externalItemId),
      ...recentLots.map((l) => l.externalItemId),
    ]);

    let candidates = CURATED_ARTWORKS_POOL.filter(
      (art) => !excludedIds.has(art.externalItemId),
    );

    if (candidates.length < totalNeeded) {
      const currentBusyIds = new Set([
        ...activeLots.map((l) => l.externalItemId),
        ...scheduledLots.map((l) => l.externalItemId),
      ]);
      candidates = CURATED_ARTWORKS_POOL.filter(
        (art) => !currentBusyIds.has(art.externalItemId),
      );
    }

    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const [auctioneers, bidders] = await Promise.all([
      this.prisma.user.findMany({ where: { role: Role.AUCTIONEER } }),
      this.prisma.user.findMany({ where: { role: Role.BIDDER } }),
    ]);

    if (auctioneers.length === 0) return;

    const now = new Date();
    const prices = [75000, 90000, 110000, 130000, 150000, 180000, 210000];
    const increments = [15000, 20000, 25000, 30000, 40000];
    const activeBrackets = [
      { min: 10, max: 18 },
      { min: 22, max: 32 },
      { min: 36, max: 50 },
    ];

    let cursor = 0;
    const activeEndTimes: Date[] = activeLots.map((l) => l.endsAt);

    // 1. Só cria direto em ACTIVE se houver menos de 3 ativos (partida inicial)
    for (
      let i = 0;
      i < missingActive && cursor < shuffled.length;
      i++, cursor++
    ) {
      const artwork = shuffled[cursor];
      const auctioneer = auctioneers[crypto.randomInt(0, auctioneers.length)];
      const startingPrice = prices[crypto.randomInt(0, prices.length)];
      const minIncrement = increments[crypto.randomInt(0, increments.length)];
      const bracket = activeBrackets[i % activeBrackets.length];
      const durationMin = crypto.randomInt(bracket.min, bracket.max + 1);

      const startsAt = new Date(
        now.getTime() - crypto.randomInt(3, 8) * 60 * 1000,
      );
      const endsAt = new Date(now.getTime() + durationMin * 60 * 1000);
      activeEndTimes.push(endsAt);

      await this.prisma.$transaction(async (tx) => {
        const created = await tx.lot.create({
          data: {
            auctioneerId: auctioneer.id,
            externalItemId: artwork.externalItemId,
            title: artwork.title,
            description: artwork.description,
            imageUrl: artwork.imageUrl,
            attributesJson: artwork.attributesJson,
            startingPrice,
            minIncrement,
            currentPrice: 0,
            startsAt,
            endsAt,
            status: LotStatus.ACTIVE,
          },
        });

        if (bidders.length >= 2) {
          await this.createInitialBids(
            tx,
            created.id,
            startingPrice,
            minIncrement,
            bidders,
            now,
          );
        }
      });
    }

    activeEndTimes.sort((a, b) => a.getTime() - b.getTime());

    // 2. Cria os próximos lotes como AGENDADOS (SCHEDULED) sincronizados com o fim dos lotes AO VIVO
    for (
      let j = 0;
      j < missingScheduled && cursor < shuffled.length;
      j++, cursor++
    ) {
      const artwork = shuffled[cursor];
      const auctioneer = auctioneers[crypto.randomInt(0, auctioneers.length)];
      const startingPrice = prices[crypto.randomInt(0, prices.length)];
      const minIncrement = increments[crypto.randomInt(0, increments.length)];

      const targetIndex =
        (scheduledLots.length + j) % Math.max(1, activeEndTimes.length);
      const pairedEndTime = activeEndTimes[targetIndex];

      const startsAt =
        pairedEndTime && pairedEndTime.getTime() > now.getTime() + 30 * 1000
          ? new Date(pairedEndTime.getTime())
          : new Date(now.getTime() + (j + 1) * 14 * 60 * 1000);

      const durationMin = crypto.randomInt(20, 45);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

      await this.prisma.lot.create({
        data: {
          auctioneerId: auctioneer.id,
          externalItemId: artwork.externalItemId,
          title: artwork.title,
          description: artwork.description,
          imageUrl: artwork.imageUrl,
          attributesJson: artwork.attributesJson,
          startingPrice,
          minIncrement,
          currentPrice: 0,
          startsAt,
          endsAt,
          status: LotStatus.SCHEDULED,
        },
      });
    }
  }

  private async createInitialBids(
    tx: any,
    lotId: string,
    startingPrice: number,
    minIncrement: number,
    bidders: Array<{ id: string }>,
    now: Date,
  ) {
    const numBids = crypto.randomInt(1, 4);
    let prevHash = this.hashChain.getGenesisHash(lotId);
    let amount = startingPrice;
    let lastBidderId: string | null = null;

    for (let seq = 1; seq <= numBids; seq++) {
      const candidates = bidders.filter((b) => b.id !== lastBidderId);
      const chosen = candidates[crypto.randomInt(0, candidates.length)];

      const freshBidder = await tx.user.findUnique({
        where: { id: chosen.id },
      });
      if (
        freshBidder &&
        freshBidder.totalBalance - freshBidder.committedBalance <
          amount + 500000
      ) {
        await tx.user.update({
          where: { id: chosen.id },
          data: { totalBalance: { increment: 2000000 } },
        });
      }

      const createdAt = new Date(now.getTime() - (numBids - seq + 1) * 35000);
      const bidHash = this.hashChain.calculateBidHash({
        lotId,
        sequenceNumber: seq,
        bidderId: chosen.id,
        amount,
        createdAtIso: createdAt.toISOString(),
        previousHash: prevHash,
      });

      await tx.bid.create({
        data: {
          lotId,
          bidderId: chosen.id,
          sequenceNumber: seq,
          amount,
          createdAt,
          previousHash: prevHash,
          bidHash,
        },
      });

      prevHash = bidHash;
      lastBidderId = chosen.id;

      if (seq < numBids) {
        amount += minIncrement * crypto.randomInt(1, 3);
      }
    }

    if (lastBidderId) {
      await tx.lot.update({
        where: { id: lotId },
        data: { currentPrice: amount, winnerId: lastBidderId },
      });

      await tx.user.update({
        where: { id: lastBidderId },
        data: { committedBalance: { increment: amount } },
      });
    }
  }
}