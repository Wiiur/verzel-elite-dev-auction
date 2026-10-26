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

  constructor(
    private readonly prisma: PrismaService,
    private readonly biddingGateway: BiddingGateway,
    private readonly hashChain: HashChainService,
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
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const now = new Date();

      // 1. Ativa lotes agendados que atingiram o horário de início
      await this.prisma.lot.updateMany({
        where: {
          status: LotStatus.SCHEDULED,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        data: { status: LotStatus.ACTIVE },
      });

      // 2. Liquida e encerra lotes ativos cujo tempo acabou
      const expiredLots = await this.prisma.lot.findMany({
        where: {
          status: { in: [LotStatus.ACTIVE, LotStatus.SCHEDULED] },
          endsAt: { lte: now },
        },
      });

      for (const expiredLot of expiredLots) {
        await this.settleExpiredLot(expiredLot.id);
      }

      // 3. Garante sempre pelo menos 3 lotes AO VIVO sem repetir obras recentes
      await this.ensureMinimumActiveLots(3);
    } catch (error) {
      this.logger.error('Erro ao sincronizar ciclo de vida dos lotes:', error);
    } finally {
      this.isSyncing = false;
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

  private async ensureMinimumActiveLots(minActiveCount: number) {
    const activeLots = await this.prisma.lot.findMany({
      where: { status: LotStatus.ACTIVE },
      select: { externalItemId: true },
    });

    if (activeLots.length >= minActiveCount) return;

    const needed = minActiveCount - activeLots.length;

    // Busca os últimos 15 lotes criados (mesmo encerrados ou agendados) para evitar repetição
    const recentLots = await this.prisma.lot.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { externalItemId: true },
    });

    const excludedExternalIds = new Set([
      ...activeLots.map((l) => l.externalItemId),
      ...recentLots.map((l) => l.externalItemId),
    ]);

    let candidatePool = CURATED_ARTWORKS_POOL.filter(
      (art) => !excludedExternalIds.has(art.externalItemId),
    );

    // Fallback de segurança caso o pool filtrado tenha menos itens que o necessário
    if (candidatePool.length < needed) {
      const activeOnlyIds = new Set(activeLots.map((l) => l.externalItemId));
      candidatePool = CURATED_ARTWORKS_POOL.filter(
        (art) => !activeOnlyIds.has(art.externalItemId),
      );
    }

    // Embaralhamento Fisher-Yates com entropia criptográfica
    const shuffled = [...candidatePool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const auctioneers = await this.prisma.user.findMany({
      where: { role: Role.AUCTIONEER },
    });
    if (auctioneers.length === 0) return;

    const bidders = await this.prisma.user.findMany({
      where: { role: Role.BIDDER },
    });

    // Janelas de duração escalonadas para que os lotes nunca encerrem todos juntos
    const durationBrackets = [
      { min: 12, max: 22 },
      { min: 28, max: 45 },
      { min: 50, max: 75 },
    ];

    for (let i = 0; i < Math.min(needed, shuffled.length); i++) {
      const artwork = shuffled[i];
      const auctioneer = auctioneers[crypto.randomInt(0, auctioneers.length)];

      const startingPriceOptions = [75000, 90000, 110000, 130000, 150000, 180000, 210000];
      const minIncrementOptions = [15000, 20000, 25000, 30000, 40000];

      const startingPrice =
        startingPriceOptions[crypto.randomInt(0, startingPriceOptions.length)];
      const minIncrement =
        minIncrementOptions[crypto.randomInt(0, minIncrementOptions.length)];

      const bracket = durationBrackets[i % durationBrackets.length];
      const durationMinutes = crypto.randomInt(bracket.min, bracket.max + 1);

      const now = new Date();
      const startsAt = new Date(now.getTime() - crypto.randomInt(3, 10) * 60 * 1000);
      const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      await this.prisma.$transaction(async (tx) => {
        const newLot = await tx.lot.create({
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

        // Sorteia de 1 a 3 lances iniciais reais para movimentar o lote recém-aberto
        if (bidders.length >= 2) {
          const numInitialBids = crypto.randomInt(1, 4); // 1, 2 ou 3 lances
          let prevHash = this.hashChain.getGenesisHash(newLot.id);
          let currentBidAmount = startingPrice;
          let lastBidderId: string | null = null;

          for (let seq = 1; seq <= numInitialBids; seq++) {
            // Escolhe um licitante diferente do líder anterior
            const eligibleBidders = bidders.filter((b) => b.id !== lastBidderId);
            const chosenBidder =
              eligibleBidders[crypto.randomInt(0, eligibleBidders.length)];

            // Garante que o licitante simulado tenha saldo suficiente (recarrega se necessário)
            const freshBidder = await tx.user.findUnique({
              where: { id: chosenBidder.id },
            });
            if (
              freshBidder &&
              freshBidder.totalBalance - freshBidder.committedBalance <
                currentBidAmount + 500000
            ) {
              await tx.user.update({
                where: { id: chosenBidder.id },
                data: { totalBalance: { increment: 2000000 } }, // +R$ 20.000,00
              });
            }

            const bidCreatedAt = new Date(
              now.getTime() - (numInitialBids - seq + 1) * 45 * 1000,
            );
            const bidHash = this.hashChain.calculateBidHash({
              lotId: newLot.id,
              sequenceNumber: seq,
              bidderId: chosenBidder.id,
              amount: currentBidAmount,
              createdAtIso: bidCreatedAt.toISOString(),
              previousHash: prevHash,
            });

            await tx.bid.create({
              data: {
                lotId: newLot.id,
                bidderId: chosenBidder.id,
                sequenceNumber: seq,
                amount: currentBidAmount,
                createdAt: bidCreatedAt,
                previousHash: prevHash,
                bidHash,
              },
            });

            prevHash = bidHash;
            lastBidderId = chosenBidder.id;

            if (seq < numInitialBids) {
              currentBidAmount += minIncrement * crypto.randomInt(1, 3);
            }
          }

          if (lastBidderId) {
            await tx.lot.update({
              where: { id: newLot.id },
              data: {
                currentPrice: currentBidAmount,
                winnerId: lastBidderId,
              },
            });

            await tx.user.update({
              where: { id: lastBidderId },
              data: {
                committedBalance: { increment: currentBidAmount },
              },
            });
          }
        }

        this.logger.log(
          `✨ Auto-Replenish: Lote "${newLot.title}" aberto automaticamente (${durationMinutes} min).`,
        );
      });
    }
  }
}