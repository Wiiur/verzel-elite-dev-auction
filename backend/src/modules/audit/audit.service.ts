import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashChainService } from '../../common/crypto/hash-chain.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
  ) {}

  async auditLot(lotId: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        auctioneer: { select: { publicAlias: true } },
        winner: { select: { publicAlias: true } },
        bids: {
          orderBy: { sequenceNumber: 'asc' },
          include: {
            bidder: { select: { publicAlias: true } },
          },
        },
      },
    });

    if (!lot) {
      throw new NotFoundException('Lote não encontrado para auditoria.');
    }

    const mappedBids = lot.bids.map((b) => ({
      id: b.id,
      sequenceNumber: b.sequenceNumber,
      bidderId: b.bidderId,
      publicAlias: b.bidder.publicAlias,
      amount: b.amount,
      createdAt: b.createdAt,
      previousHash: b.previousHash,
      bidHash: b.bidHash,
    }));

    const verification = this.hashChain.verifyLotHistory(lot.id, mappedBids);

    return {
      lot: {
        id: lot.id,
        title: lot.title,
        imageUrl: lot.imageUrl,
        status: lot.status,
        startingPrice: lot.startingPrice,
        currentPrice: lot.currentPrice,
        auctioneerAlias: lot.auctioneer.publicAlias,
        winnerAlias: lot.winner?.publicAlias ?? null,
        startsAt: lot.startsAt,
        endsAt: lot.endsAt,
      },
      verification,
    };
  }

  async getPublicReceipt(receiptIdOrLotId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        OR: [{ id: receiptIdOrLotId }, { lotId: receiptIdOrLotId }],
      },
      include: {
        lot: {
          include: {
            auctioneer: { select: { publicAlias: true } },
            winner: { select: { publicAlias: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Comprovativo de arremate não encontrado.');
    }

    return {
      receiptId: receipt.id,
      lotId: receipt.lotId,
      issuedAt: receipt.issuedAt,
      finalAmount: receipt.finalAmount,
      verificationHash: receipt.verificationHash,
      lotTitle: receipt.lot.title,
      lotImageUrl: receipt.lot.imageUrl,
      attributesJson: receipt.lot.attributesJson,
      auctioneerAlias: receipt.lot.auctioneer.publicAlias,
      winnerAlias: receipt.lot.winner?.publicAlias ?? 'N/A',
    };
  }
}