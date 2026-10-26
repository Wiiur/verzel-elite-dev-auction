import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { HashChainService } from '../../common/crypto/hash-chain.service';
import { LotStatus, Role } from '@prisma/client';

describe('BiddingService (Regras de Lance, Saldo Comprometido e Anti-Sniping)', () => {
  let service: BiddingService;
  let mockTx: any;
  let mockGateway: any;

  beforeEach(() => {
    mockTx = {
      $queryRaw: jest.fn(),
      lot: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bid: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockPrisma = {
      $transaction: jest.fn((callback) => callback(mockTx)),
    };

    mockGateway = {
      broadcastNewBid: jest.fn(),
    };

    service = new BiddingService(
      mockPrisma as any,
      new HashChainService(),
      mockGateway,
    );
  });

  it('deve recusar lance feito por um LEILOEIRO (AUCTIONEER)', async () => {
    mockTx.lot.findUnique.mockResolvedValue({ id: 'lot-1', status: LotStatus.ACTIVE });
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-auctioneer',
      role: Role.AUCTIONEER,
    });

    await expect(service.placeBid('lot-1', 'user-auctioneer', 10000)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deve recusar quando o licitante líder tenta cobrir o próprio lance', async () => {
    const now = new Date();
    mockTx.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 60000),
      endsAt: new Date(now.getTime() + 600000),
      startingPrice: 10000,
      minIncrement: 2000,
      currentPrice: 12000,
    });
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: Role.BIDDER,
      totalBalance: 50000,
      committedBalance: 12000,
    });
    mockTx.bid.findFirst.mockResolvedValue({
      id: 'bid-1',
      bidderId: 'user-1',
      amount: 12000,
      sequenceNumber: 1,
    });

    await expect(service.placeBid('lot-1', 'user-1', 15000)).rejects.toThrow(
      'Lance recusado: você já está ganhando este lote.',
    );
  });

  it('deve recusar lance quando o saldo disponível (total - comprometido) for insuficiente', async () => {
    const now = new Date();
    mockTx.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 60000),
      endsAt: new Date(now.getTime() + 600000),
      startingPrice: 10000,
      minIncrement: 2000,
      currentPrice: 10000,
    });
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-2',
      role: Role.BIDDER,
      totalBalance: 20000,
      committedBalance: 10000, // Disponível = 10000, insuficiente para lance de 15000
    });
    mockTx.bid.findFirst.mockResolvedValue({
      id: 'bid-1',
      bidderId: 'user-1',
      amount: 10000,
      sequenceNumber: 1,
    });

    await expect(service.placeBid('lot-1', 'user-2', 15000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve prorrogar o lote em +2 minutos (Anti-Sniping) quando o lance ocorre nos últimos 2 minutos', async () => {
    const now = new Date();
    const endsInOneMinute = new Date(now.getTime() + 60 * 1000); // Faltam 60s (< 2 min)

    mockTx.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 600000),
      endsAt: endsInOneMinute,
      startingPrice: 10000,
      minIncrement: 2000,
      currentPrice: 10000,
    });
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-2',
      publicAlias: 'Licitante #B2',
      role: Role.BIDDER,
      totalBalance: 50000,
      committedBalance: 0,
    });
    mockTx.bid.findFirst.mockResolvedValue({
      id: 'bid-1',
      bidderId: 'user-1',
      amount: 10000,
      sequenceNumber: 1,
      bidHash: 'hash-1',
    });
    mockTx.bid.create.mockResolvedValue({
      id: 'bid-2',
      sequenceNumber: 2,
      amount: 15000,
      createdAt: now,
    });
    mockTx.lot.update.mockImplementation(({ data }: any) => ({
      id: 'lot-1',
      endsAt: data.endsAt,
    }));

    await service.placeBid('lot-1', 'user-2', 15000);

    // Verifica que liberou o saldo do líder anterior (user-1) e comprometeu o do novo líder (user-2)
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { committedBalance: { decrement: 10000 } },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { committedBalance: { increment: 15000 } },
    });

    // Verifica que o horário de término foi estendido em +2 minutos (120.000 ms)
    const updateCallData = mockTx.lot.update.mock.calls[0][0].data;
    expect(updateCallData.endsAt.getTime()).toBe(
      endsInOneMinute.getTime() + 2 * 60 * 1000,
    );
  });
});