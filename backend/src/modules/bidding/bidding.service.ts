import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashChainService } from '../../common/crypto/hash-chain.service';
import { BiddingGateway } from './bidding.gateway';
import { LotStatus, Role } from '@prisma/client';

@Injectable()
export class BiddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly biddingGateway: BiddingGateway,
  ) {}

  async placeBid(lotId: string, userId: string, amountInCents: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock pessimista no lote para impedir race conditions em lances simultâneos
      await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE`;

      const lot = await tx.lot.findUnique({
        where: { id: lotId },
      });

      if (!lot) {
        throw new NotFoundException('Lote não encontrado.');
      }

      const bidder = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!bidder) {
        throw new NotFoundException('Utilizador não encontrado.');
      }

      if (bidder.role === Role.AUCTIONEER) {
        throw new ForbiddenException('Leiloeiros não podem dar lances.');
      }

      const now = new Date();

      if (now < lot.startsAt || lot.status === LotStatus.SCHEDULED) {
        throw new BadRequestException('Lance recusado: este lote ainda não foi iniciado.');
      }

      if (now >= lot.endsAt || lot.status !== LotStatus.ACTIVE) {
        throw new BadRequestException('Lance recusado: este lote já foi encerrado.');
      }

      const highestBid = await tx.bid.findFirst({
        where: { lotId },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (highestBid && highestBid.bidderId === userId) {
        throw new BadRequestException('Lance recusado: você já está ganhando este lote.');
      }

      const minimumRequired = highestBid
        ? lot.currentPrice + lot.minIncrement
        : lot.startingPrice;

      if (amountInCents < minimumRequired) {
        const minFormatted = (minimumRequired / 100).toFixed(2);
        throw new BadRequestException(
          `Lance recusado: valor abaixo do mínimo exigido (R$ ${minFormatted}).`,
        );
      }

      const availableBalance = bidder.totalBalance - bidder.committedBalance;
      if (amountInCents > availableBalance) {
        throw new BadRequestException(
          'Lance recusado: saldo disponível insuficiente na sua carteira.',
        );
      }

      if (highestBid) {
        await tx.user.update({
          where: { id: highestBid.bidderId },
          data: {
            committedBalance: { decrement: highestBid.amount },
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          committedBalance: { increment: amountInCents },
        },
      });

      const TWO_MINUTES_MS = 2 * 60 * 1000;
      const timeRemainingMs = lot.endsAt.getTime() - now.getTime();
      let newEndsAt = lot.endsAt;
      let wasExtended = false;

      if (timeRemainingMs <= TWO_MINUTES_MS) {
        newEndsAt = new Date(lot.endsAt.getTime() + TWO_MINUTES_MS);
        wasExtended = true;
      }

      const nextSequence = (highestBid?.sequenceNumber ?? 0) + 1;
      const previousHash = highestBid
        ? highestBid.bidHash
        : this.hashChain.getGenesisHash(lot.id);

      const bidCreatedAt = new Date();
      const bidHash = this.hashChain.calculateBidHash({
        lotId: lot.id,
        sequenceNumber: nextSequence,
        bidderId: userId,
        amount: amountInCents,
        createdAtIso: bidCreatedAt.toISOString(),
        previousHash,
      });

      const createdBid = await tx.bid.create({
        data: {
          lotId: lot.id,
          bidderId: userId,
          sequenceNumber: nextSequence,
          amount: amountInCents,
          createdAt: bidCreatedAt,
          previousHash,
          bidHash,
        },
      });

      const updatedLot = await tx.lot.update({
        where: { id: lot.id },
        data: {
          currentPrice: amountInCents,
          winnerId: userId,
          endsAt: newEndsAt,
        },
      });

      return {
        createdBid,
        updatedLot,
        bidderAlias: bidder.publicAlias,
        previousLeaderId: highestBid?.bidderId ?? null,
        wasExtended,
      };
    });

    this.biddingGateway.broadcastNewBid(lotId, {
      bidId: result.createdBid.id,
      sequenceNumber: result.createdBid.sequenceNumber,
      amount: result.createdBid.amount,
      bidderAlias: result.bidderAlias,
      leaderId: userId,
      previousLeaderId: result.previousLeaderId,
      endsAt: result.updatedLot.endsAt,
      wasExtended: result.wasExtended,
      createdAt: result.createdBid.createdAt,
    });

    return result.createdBid;
  }
}