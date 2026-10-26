import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        totalBalance: true,
        committedBalance: true,
      },
    });

    if (!user) throw new NotFoundException('Utilizador não encontrado.');

    return {
      totalBalance: user.totalBalance,
      committedBalance: user.committedBalance,
      availableBalance: user.totalBalance - user.committedBalance,
    };
  }

  async simulateDeposit(userId: string, amountInCents: number) {
    if (amountInCents <= 0) {
      throw new BadRequestException('O valor do depósito deve ser maior que zero.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');

    if (user.role !== Role.BIDDER) {
      throw new ForbiddenException('Apenas licitantes podem depositar saldo para lances.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalBalance: { increment: amountInCents },
      },
    });

    return {
      message: 'Depósito simulado realizado com sucesso.',
      totalBalance: updated.totalBalance,
      committedBalance: updated.committedBalance,
      availableBalance: updated.totalBalance - updated.committedBalance,
    };
  }

  /**
   * Retorna os lotes em que o utilizador participou e os lotes vencidos com comprovativo ("Meus Arremates")
   */
  async getMyBidsAndWins(userId: string) {
    const participatedLots = await this.prisma.lot.findMany({
      where: {
        bids: { some: { bidderId: userId } },
      },
      include: {
        receipt: true,
        bids: {
          where: { bidderId: userId },
          orderBy: { amount: 'desc' },
          take: 1,
        },
      },
      orderBy: { endsAt: 'desc' },
    });

    return participatedLots.map((lot) => ({
      lotId: lot.id,
      title: lot.title,
      imageUrl: lot.imageUrl,
      status: lot.status,
      currentPrice: lot.currentPrice,
      myHighestBid: lot.bids[0]?.amount ?? 0,
      isLeadingOrWinner: lot.winnerId === userId,
      endsAt: lot.endsAt,
      receipt: lot.winnerId === userId ? lot.receipt : null,
    }));
  }
}