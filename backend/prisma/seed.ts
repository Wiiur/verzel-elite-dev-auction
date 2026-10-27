import { PrismaClient, LotStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CURATED_ARTWORKS_POOL } from '../src/modules/lots/curated-lots.data';

const prisma = new PrismaClient();
const HMAC_SECRET =
  process.env.AUDIT_HMAC_SECRET || 'verzel-elite-dev-hmac-secret-2026';

function getGenesisHash(lotId: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`GENESIS:${lotId}`)
    .digest('hex');
}

function calculateBidHash(payload: {
  lotId: string;
  sequenceNumber: number;
  bidderId: string;
  amount: number;
  createdAtIso: string;
  previousHash: string;
}): string {
  const rawData = [
    payload.lotId,
    payload.sequenceNumber.toString(),
    payload.bidderId,
    payload.amount.toString(),
    payload.createdAtIso,
    payload.previousHash,
  ].join('|');

  return crypto.createHmac('sha256', HMAC_SECRET).update(rawData).digest('hex');
}

async function main() {
  console.log('🌱 Semeando Casa de Leilões Verzel com catálogo sincronizado...');

  // 1. Limpeza segura respeitando chaves estrangeiras
  await prisma.receipt.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Criação de Leiloeiros e Licitantes
  const [auctioneer1, auctioneer2] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Carlos Albuquerque',
        email: 'leiloeiro@verzel.com.br',
        passwordHash,
        role: Role.AUCTIONEER,
        publicAlias: 'Leiloeiro #OFICIAL',
        totalBalance: 0,
        committedBalance: 0,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Helena Sotheby',
        email: 'curadoria@verzel.com.br',
        passwordHash,
        role: Role.AUCTIONEER,
        publicAlias: 'Leiloeiro #CURADORIA',
        totalBalance: 0,
        committedBalance: 0,
      },
    }),
  ]);

  const bidders = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Ana Colecionadora',
        email: 'cliente1@verzel.com.br',
        passwordHash,
        role: Role.BIDDER,
        publicAlias: 'Licitante #A7F2',
        totalBalance: 2500000, // R$ 25.000,00
        committedBalance: 0,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bruno Investidor',
        email: 'cliente2@verzel.com.br',
        passwordHash,
        role: Role.BIDDER,
        publicAlias: 'Licitante #B9C4',
        totalBalance: 3000000, // R$ 30.000,00
        committedBalance: 0,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Camila Galeria SP',
        email: 'cliente3@verzel.com.br',
        passwordHash,
        role: Role.BIDDER,
        publicAlias: 'Licitante #C3D8',
        totalBalance: 2800000, // R$ 28.000,00
        committedBalance: 0,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Diego Mecenas',
        email: 'cliente4@verzel.com.br',
        passwordHash,
        role: Role.BIDDER,
        publicAlias: 'Licitante #D5E1',
        totalBalance: 3500000, // R$ 35.000,00
        committedBalance: 0,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Elena Museu Europeu',
        email: 'cliente5@verzel.com.br',
        passwordHash,
        role: Role.BIDDER,
        publicAlias: 'Licitante #E2A9',
        totalBalance: 4000000, // R$ 40.000,00
        committedBalance: 0,
      },
    }),
  ]);

  const [b1, b2, b3, b4, b5] = bidders;
  const now = new Date();
  const min = (m: number) => new Date(now.getTime() + m * 60 * 1000);

  // Helper para criar lote e encadear lances com HMAC-SHA256
  async function createSeededLot(params: {
    artIndex: number;
    auctioneerId: string;
    startingPrice: number;
    minIncrement: number;
    startsAt: Date;
    endsAt: Date;
    status: LotStatus;
    bidSequence?: Array<{ bidderId: string; amount: number; minutesAgo: number }>;
  }) {
    const art = CURATED_ARTWORKS_POOL[params.artIndex];

    const lot = await prisma.lot.create({
      data: {
        auctioneerId: params.auctioneerId,
        externalItemId: art.externalItemId,
        title: art.title,
        description: art.description,
        imageUrl: art.imageUrl,
        attributesJson: art.attributesJson,
        startingPrice: params.startingPrice,
        minIncrement: params.minIncrement,
        currentPrice: 0,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        status: params.status,
      },
    });

    const bids = params.bidSequence || [];
    if (bids.length === 0) return lot;

    let prevHash = getGenesisHash(lot.id);
    let lastBidHash = prevHash;
    let lastBidderId = bids[0].bidderId;
    let lastAmount = bids[0].amount;

    for (let i = 0; i < bids.length; i++) {
      const sequenceNumber = i + 1;
      const item = bids[i];
      const createdAt = min(-item.minutesAgo);

      const bidHash = calculateBidHash({
        lotId: lot.id,
        sequenceNumber,
        bidderId: item.bidderId,
        amount: item.amount,
        createdAtIso: createdAt.toISOString(),
        previousHash: prevHash,
      });

      await prisma.bid.create({
        data: {
          lotId: lot.id,
          bidderId: item.bidderId,
          sequenceNumber,
          amount: item.amount,
          createdAt,
          previousHash: prevHash,
          bidHash,
        },
      });

      prevHash = bidHash;
      lastBidHash = bidHash;
      lastBidderId = item.bidderId;
      lastAmount = item.amount;
    }

    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        currentPrice: lastAmount,
        winnerId: params.status === LotStatus.CANCELLED ? null : lastBidderId,
      },
    });

    // Se o lote está ATIVO, bloqueia o saldo comprometido do líder atual
    if (params.status === LotStatus.ACTIVE) {
      await prisma.user.update({
        where: { id: lastBidderId },
        data: {
          committedBalance: { increment: lastAmount },
        },
      });
    }

    // Se o lote já nasceu FINALIZADO, liquida saldos e emite Comprovante Oficial
    if (params.status === LotStatus.FINISHED) {
      await prisma.user.update({
        where: { id: lastBidderId },
        data: { totalBalance: { decrement: lastAmount } },
      });

      await prisma.user.update({
        where: { id: params.auctioneerId },
        data: { totalBalance: { increment: lastAmount } },
      });

      const verificationHash = crypto
        .createHash('sha256')
        .update(`RECEIPT:${lot.id}:${lastBidderId}:${lastAmount}:${lastBidHash}`)
        .digest('hex');

      await prisma.receipt.create({
        data: {
          lotId: lot.id,
          finalAmount: lastAmount,
          verificationHash,
        },
      });
    }

    return lot;
  }

  // 3. Lotes AO VIVO (ACTIVE) com tempos escalonados e lances encadeados
  await createSeededLot({
    artIndex: 0, // A Sunday on La Grande Jatte
    auctioneerId: auctioneer1.id,
    startingPrice: 150000,
    minIncrement: 25000,
    startsAt: min(-40),
    endsAt: min(45),
    status: LotStatus.ACTIVE,
    bidSequence: [
      { bidderId: b1.id, amount: 150000, minutesAgo: 35 },
      { bidderId: b2.id, amount: 175000, minutesAgo: 28 },
      { bidderId: b3.id, amount: 200000, minutesAgo: 19 },
      { bidderId: b1.id, amount: 225000, minutesAgo: 12 },
      { bidderId: b4.id, amount: 250000, minutesAgo: 5 },
    ],
  });

  await createSeededLot({
    artIndex: 1, // The Great Wave off Kanagawa
    auctioneerId: auctioneer1.id,
    startingPrice: 120000,
    minIncrement: 20000,
    startsAt: min(-30),
    endsAt: min(65),
    status: LotStatus.ACTIVE,
    bidSequence: [
      { bidderId: b2.id, amount: 120000, minutesAgo: 25 },
      { bidderId: b5.id, amount: 140000, minutesAgo: 18 },
      { bidderId: b3.id, amount: 160000, minutesAgo: 9 },
      { bidderId: b2.id, amount: 180000, minutesAgo: 3 },
    ],
  });

  await createSeededLot({
    artIndex: 2, // The Bedroom in Arles (Nos minutos finais para testar Anti-Sniping!)
    auctioneerId: auctioneer2.id,
    startingPrice: 180000,
    minIncrement: 30000,
    startsAt: min(-50),
    endsAt: min(15),
    status: LotStatus.ACTIVE,
    bidSequence: [
      { bidderId: b4.id, amount: 180000, minutesAgo: 40 },
      { bidderId: b1.id, amount: 210000, minutesAgo: 22 },
      { bidderId: b5.id, amount: 240000, minutesAgo: 10 },
      { bidderId: b3.id, amount: 270000, minutesAgo: 4 },
    ],
  });

  await createSeededLot({
    artIndex: 3, // Paris Street; Rainy Day
    auctioneerId: auctioneer2.id,
    startingPrice: 200000,
    minIncrement: 35000,
    startsAt: min(-25),
    endsAt: min(90),
    status: LotStatus.ACTIVE,
    bidSequence: [
      { bidderId: b1.id, amount: 200000, minutesAgo: 20 },
      { bidderId: b4.id, amount: 235000, minutesAgo: 11 },
      { bidderId: b5.id, amount: 270000, minutesAgo: 2 },
    ],
  });

  // 4. Lotes AGENDADOS (SCHEDULED)
  await createSeededLot({
    artIndex: 4, // Nighthawks
    auctioneerId: auctioneer1.id,
    startingPrice: 140000,
    minIncrement: 20000,
    startsAt: min(30),
    endsAt: min(120),
    status: LotStatus.SCHEDULED,
  });

  await createSeededLot({
    artIndex: 5, // American Gothic
    auctioneerId: auctioneer2.id,
    startingPrice: 110000,
    minIncrement: 15000,
    startsAt: min(60),
    endsAt: min(180),
    status: LotStatus.SCHEDULED,
  });

  await createSeededLot({
    artIndex: 6, // Water Lilies — Claude Monet
    auctioneerId: auctioneer1.id,
    startingPrice: 220000,
    minIncrement: 30000,
    startsAt: min(90),
    endsAt: min(240),
    status: LotStatus.SCHEDULED,
  });

  // 5. Lote ARREMATADO (FINISHED) com Comprovante Oficial emitido para Ana (Cliente 1)
  await createSeededLot({
    artIndex: 7, // The Starry Night — Vincent van Gogh
    auctioneerId: auctioneer1.id,
    startingPrice: 300000,
    minIncrement: 40000,
    startsAt: min(-180),
    endsAt: min(-60),
    status: LotStatus.FINISHED,
    bidSequence: [
      { bidderId: b2.id, amount: 300000, minutesAgo: 160 },
      { bidderId: b4.id, amount: 340000, minutesAgo: 130 },
      { bidderId: b3.id, amount: 380000, minutesAgo: 95 },
      { bidderId: b1.id, amount: 420000, minutesAgo: 70 },
    ],
  });

  // 6. Lote ENCERRADO SEM LANCES (UNSOLD)
  await createSeededLot({
    artIndex: 16, // Composition VIII — Wassily Kandinsky
    auctioneerId: auctioneer2.id,
    startingPrice: 190000,
    minIncrement: 25000,
    startsAt: min(-150),
    endsAt: min(-30),
    status: LotStatus.UNSOLD,
  });

  // 7. Lote CANCELADO PELO LEILOEIRO (CANCELLED)
  await createSeededLot({
    artIndex: 9, // Girl with a Pearl Earring
    auctioneerId: auctioneer1.id,
    startingPrice: 160000,
    minIncrement: 20000,
    startsAt: min(-90),
    endsAt: min(30),
    status: LotStatus.CANCELLED,
    bidSequence: [
      { bidderId: b3.id, amount: 160000, minutesAgo: 60 },
      { bidderId: b2.id, amount: 180000, minutesAgo: 45 },
    ],
  });

  console.log('✅ Seed completo! Plataforma populada com catálogo unificado.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });