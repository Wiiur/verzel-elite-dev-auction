import { PrismaClient, Role, LotStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const HMAC_SECRET =
  process.env.AUDIT_HMAC_SECRET || 'verzel-elite-dev-hmac-secret-2026';

function getGenesisHash(lotId: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`GENESIS:${lotId}`)
    .digest('hex');
}

function calcBidHash(
  lotId: string,
  seq: number,
  bidderId: string,
  amount: number,
  createdAtIso: string,
  prevHash: string,
): string {
  const raw = [
    lotId,
    seq.toString(),
    bidderId,
    amount.toString(),
    createdAtIso,
    prevHash,
  ].join('|');
  return crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex');
}

/**
 * Helper que insere uma sequência de lances em um lote mantendo a Hash Chain
 * 100% íntegra e atualizando o preço atual e o líder do lote.
 */
async function seedBidsForLot(
  lotId: string,
  bidsInput: Array<{ bidderId: string; amount: number; minutesAgo: number }>,
) {
  const now = new Date();
  let prevHash = getGenesisHash(lotId);
  let seq = 1;
  let lastBidderId: string | null = null;
  let lastAmount = 0;
  let lastBidHash = prevHash;

  for (const b of bidsInput) {
    const createdAt = new Date(now.getTime() - b.minutesAgo * 60 * 1000);
    const bidHash = calcBidHash(
      lotId,
      seq,
      b.bidderId,
      b.amount,
      createdAt.toISOString(),
      prevHash,
    );

    await prisma.bid.create({
      data: {
        lotId,
        bidderId: b.bidderId,
        sequenceNumber: seq,
        amount: b.amount,
        createdAt,
        previousHash: prevHash,
        bidHash,
      },
    });

    prevHash = bidHash;
    lastBidHash = bidHash;
    lastBidderId = b.bidderId;
    lastAmount = b.amount;
    seq++;
  }

  if (lastBidderId) {
    await prisma.lot.update({
      where: { id: lotId },
      data: {
        currentPrice: lastAmount,
        winnerId: lastBidderId,
      },
    });
  }

  return { lastBidderId, lastAmount, lastBidHash };
}

async function main() {
  console.log('🌱 Semeando Casa de Leilões Verzel com alto volume de dados...');

  // 1. Limpa o banco na ordem correta
  await prisma.receipt.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // =========================================================================
  // 2. CRIANDO LEILOEIROS E CLIENTES (LICITANTES)
  // =========================================================================
  const auctioneer1 = await prisma.user.create({
    data: {
      name: 'Carlos Albuquerque (Leiloeiro Oficial)',
      publicAlias: 'Leiloeiro #OFICIAL',
      email: 'leiloeiro@verzel.com.br',
      passwordHash,
      role: Role.AUCTIONEER,
      totalBalance: 420000, // Já recebeu R$ 4.200,00 de lote liquidado
      committedBalance: 0,
    },
  });

  const auctioneer2 = await prisma.user.create({
    data: {
      name: 'Helena Sotheby (Curadora Sênior)',
      publicAlias: 'Leiloeiro #CURADORIA',
      email: 'curadoria@verzel.com.br',
      passwordHash,
      role: Role.AUCTIONEER,
      totalBalance: 0,
      committedBalance: 0,
    },
  });

  const bidder1 = await prisma.user.create({
    data: {
      name: 'Ana Colecionadora',
      publicAlias: 'Licitante #A7F2',
      email: 'cliente1@verzel.com.br',
      passwordHash,
      role: Role.BIDDER,
      totalBalance: 1500000, // R$ 15.000,00
      committedBalance: 0,
    },
  });

  const bidder2 = await prisma.user.create({
    data: {
      name: 'Bruno Investidor',
      publicAlias: 'Licitante #B9C4',
      email: 'cliente2@verzel.com.br',
      passwordHash,
      role: Role.BIDDER,
      totalBalance: 2200000, // R$ 22.000,00
      committedBalance: 0,
    },
  });

  const bidder3 = await prisma.user.create({
    data: {
      name: 'Camila Galeria SP',
      publicAlias: 'Licitante #C3D8',
      email: 'cliente3@verzel.com.br',
      passwordHash,
      role: Role.BIDDER,
      totalBalance: 1800000, // R$ 18.000,00
      committedBalance: 0,
    },
  });

  const bidder4 = await prisma.user.create({
    data: {
      name: 'Diego Mecenas',
      publicAlias: 'Licitante #D5E1',
      email: 'cliente4@verzel.com.br',
      passwordHash,
      role: Role.BIDDER,
      totalBalance: 3000000, // R$ 30.000,00
      committedBalance: 0,
    },
  });

  const bidder5 = await prisma.user.create({
    data: {
      name: 'Elena Museu Europeu',
      publicAlias: 'Licitante #E2A9',
      email: 'cliente5@verzel.com.br',
      passwordHash,
      role: Role.BIDDER,
      totalBalance: 2500000, // R$ 25.000,00
      committedBalance: 0,
    },
  });

  const now = new Date();

  // =========================================================================
  // 3. LOTES AO VIVO (ACTIVE) — 4 Lotes com intensa disputa
  // =========================================================================

  // Lote Ao Vivo 1: A Sunday on La Grande Jatte (5 lances — Líder: Bruno)
  const liveLot1 = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-27992',
      title: 'A Sunday on La Grande Jatte — Georges Seurat',
      description: 'Obra-prima máxima do pontilhismo francês do século XIX.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/1280px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg',
      attributesJson: {
        artist: 'Georges Seurat',
        dateDisplay: '1884–1886',
        medium: 'Oil on canvas',
        origin: 'France',
      },
      startingPrice: 100000, // R$ 1.000,00
      minIncrement: 25000,   // R$ 250,00
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 45 * 60 * 1000),
      endsAt: new Date(now.getTime() + 50 * 60 * 1000),
      status: LotStatus.ACTIVE,
    },
  });

  await seedBidsForLot(liveLot1.id, [
    { bidderId: bidder1.id, amount: 100000, minutesAgo: 40 },
    { bidderId: bidder3.id, amount: 125000, minutesAgo: 32 },
    { bidderId: bidder4.id, amount: 160000, minutesAgo: 25 },
    { bidderId: bidder1.id, amount: 200000, minutesAgo: 15 },
    { bidderId: bidder2.id, amount: 250000, minutesAgo: 5 }, // Bruno lidera com R$ 2.500,00
  ]);

  // Lote Ao Vivo 2: The Great Wave off Kanagawa (6 lances — Líder: Ana)
  const liveLot2 = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-24645',
      title: 'The Great Wave off Kanagawa — Katsushika Hokusai',
      description: 'Xilogravura japonesa original da série Trinta e Seis Vistas do Monte Fuji.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg',
      attributesJson: {
        artist: 'Katsushika Hokusai',
        dateDisplay: '1831',
        medium: 'Woodblock print (ukiyo-e)',
        origin: 'Japan',
      },
      startingPrice: 80000, // R$ 800,00
      minIncrement: 20000,  // R$ 200,00
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 25 * 60 * 1000),
      status: LotStatus.ACTIVE,
    },
  });

  await seedBidsForLot(liveLot2.id, [
    { bidderId: bidder2.id, amount: 80000, minutesAgo: 55 },
    { bidderId: bidder5.id, amount: 110000, minutesAgo: 42 },
    { bidderId: bidder3.id, amount: 140000, minutesAgo: 30 },
    { bidderId: bidder2.id, amount: 180000, minutesAgo: 18 },
    { bidderId: bidder4.id, amount: 210000, minutesAgo: 9 },
    { bidderId: bidder1.id, amount: 240000, minutesAgo: 2 }, // Ana lidera com R$ 2.400,00
  ]);

  // Lote Ao Vivo 3: The Bedroom — Van Gogh (RETA FINAL: Termina em 5 minutos!)
  const liveLot3 = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-28560',
      title: 'The Bedroom in Arles — Vincent van Gogh',
      description: 'Estudo pós-impressionista vibrante do quarto de Van Gogh na Casa Amarela.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg/1280px-Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg',
      attributesJson: {
        artist: 'Vincent van Gogh',
        dateDisplay: '1889',
        medium: 'Oil on canvas',
        origin: 'France',
      },
      startingPrice: 150000, // R$ 1.500,00
      minIncrement: 30000,   // R$ 300,00
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 50 * 60 * 1000),
      endsAt: new Date(now.getTime() + 5 * 60 * 1000), // Faltam só 5 min! Ótimo para testar Anti-Sniping
      status: LotStatus.ACTIVE,
    },
  });

  await seedBidsForLot(liveLot3.id, [
    { bidderId: bidder5.id, amount: 150000, minutesAgo: 45 },
    { bidderId: bidder1.id, amount: 190000, minutesAgo: 20 },
    { bidderId: bidder3.id, amount: 230000, minutesAgo: 8 },
    { bidderId: bidder4.id, amount: 280000, minutesAgo: 3 }, // Diego lidera com R$ 2.800,00
  ]);

  // Lote Ao Vivo 4: Paris Street; Rainy Day — Gustave Caillebotte (3 lances — Líder: Camila)
  const liveLot4 = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer2.id,
      externalItemId: 'artic-20684',
      title: 'Paris Street; Rainy Day — Gustave Caillebotte',
      description: 'Perspectiva monumental da Place de Dublin em Paris num dia chuvoso.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg/1280px-Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg',
      attributesJson: {
        artist: 'Gustave Caillebotte',
        dateDisplay: '1877',
        medium: 'Oil on canvas',
        origin: 'France',
      },
      startingPrice: 120000, // R$ 1.200,00
      minIncrement: 20000,   // R$ 200,00
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 25 * 60 * 1000),
      endsAt: new Date(now.getTime() + 90 * 60 * 1000),
      status: LotStatus.ACTIVE,
    },
  });

  await seedBidsForLot(liveLot4.id, [
    { bidderId: bidder2.id, amount: 120000, minutesAgo: 20 },
    { bidderId: bidder5.id, amount: 150000, minutesAgo: 12 },
    { bidderId: bidder3.id, amount: 180000, minutesAgo: 4 }, // Camila lidera com R$ 1.800,00
  ]);

  // =========================================================================
  // 4. LOTES AGENDADOS (SCHEDULED) — 3 Lotes futuros
  // =========================================================================
  await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-111628',
      title: 'Nighthawks — Edward Hopper (1942)',
      description: 'Pintura icônica do realismo norte-americano retratando um diner noturno.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nighthawks_by_Edward_Hopper_1942.jpg/1280px-Nighthawks_by_Edward_Hopper_1942.jpg',
      attributesJson: {
        artist: 'Edward Hopper',
        dateDisplay: '1942',
        medium: 'Oil on canvas',
        origin: 'United States',
      },
      startingPrice: 200000,
      minIncrement: 50000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      status: LotStatus.SCHEDULED,
    },
  });

  await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-6565',
      title: 'American Gothic — Grant Wood (1930)',
      description: 'Retrato histórico da resiliência rural norte-americana do século XX.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg/1024px-Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg',
      attributesJson: {
        artist: 'Grant Wood',
        dateDisplay: '1930',
        medium: 'Oil on beaverboard',
        origin: 'United States',
      },
      startingPrice: 180000,
      minIncrement: 30000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      status: LotStatus.SCHEDULED,
    },
  });

  await prisma.lot.create({
    data: {
      auctioneerId: auctioneer2.id,
      externalItemId: 'artic-16568',
      title: 'Water Lilies (Nymphéas) — Claude Monet',
      description: 'Pintura impressionista do jardim aquático de Giverny.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg/1280px-Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg',
      attributesJson: {
        artist: 'Claude Monet',
        dateDisplay: '1906',
        medium: 'Oil on canvas',
        origin: 'France',
      },
      startingPrice: 250000,
      minIncrement: 40000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      status: LotStatus.SCHEDULED,
    },
  });

  // =========================================================================
  // 5. LOTES ENCERRADOS (FINISHED & UNSOLD) + COMPROVANTE DE ARREMATE
  // =========================================================================

  // Lote Encerrado 1: Vencido por Ana (Cliente 1) com Comprovante Oficial emitido!
  const finishedLot = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-15468',
      title: 'The Starry Night (Estudo Litográfico) — Vincent van Gogh',
      description: 'Lote encerrado e liquidado com comprovante criptográfico disponível.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
      attributesJson: {
        artist: 'Vincent van Gogh',
        dateDisplay: '1889',
        medium: 'Oil on canvas / Lithograph',
        origin: 'France',
      },
      startingPrice: 300000,
      minIncrement: 40000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      status: LotStatus.FINISHED,
    },
  });

  const finishedBidsResult = await seedBidsForLot(finishedLot.id, [
    { bidderId: bidder2.id, amount: 300000, minutesAgo: 240 },
    { bidderId: bidder4.id, amount: 360000, minutesAgo: 180 },
    { bidderId: bidder1.id, amount: 420000, minutesAgo: 90 }, // Ana venceu por R$ 4.200,00
  ]);

  // Gera o Comprovante Oficial para que Ana já tenha um arremate em "Meus Arremates"
  const verificationHash = crypto
    .createHash('sha256')
    .update(
      `RECEIPT:${finishedLot.id}:${bidder1.id}:${finishedBidsResult.lastAmount}:${finishedBidsResult.lastBidHash}`,
    )
    .digest('hex');

  await prisma.receipt.create({
    data: {
      lotId: finishedLot.id,
      finalAmount: finishedBidsResult.lastAmount,
      verificationHash,
    },
  });

  // Lote Encerrado 2: Sem lances (UNSOLD)
  await prisma.lot.create({
    data: {
      auctioneerId: auctioneer2.id,
      externalItemId: 'artic-99901',
      title: 'Composition VIII — Wassily Kandinsky',
      description: 'Obra abstrata geométrica encerrada sem atingir o lance mínimo.',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Vassily_Kandinsky%2C_1923_-_Composition_8%2C_oil_on_canvas%2C_140_x_201_cm%2C_Solomon_R._Guggenheim_Museum%2C_New_York.jpg/1280px-Vassily_Kandinsky%2C_1923_-_Composition_8%2C_oil_on_canvas%2C_140_x_201_cm%2C_Solomon_R._Guggenheim_Museum%2C_New_York.jpg',
      attributesJson: {
        artist: 'Wassily Kandinsky',
        dateDisplay: '1923',
        medium: 'Oil on canvas',
        origin: 'Russia / Germany',
      },
      startingPrice: 950000,
      minIncrement: 50000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      status: LotStatus.UNSOLD,
    },
  });

  // =========================================================================
  // 6. LOTE CANCELADO (CANCELLED) — Aparece só no Painel do Leiloeiro, nunca na Vitrine
  // =========================================================================
  await prisma.lot.create({
    data: {
      auctioneerId: auctioneer1.id,
      externalItemId: 'artic-77701',
      title: 'The Persistence of Memory (Retirado de Pauta) — Salvador Dalí',
      description: 'Lote cancelado pelo leiloeiro antes do encerramento.',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80',
      attributesJson: {
        artist: 'Salvador Dalí',
        dateDisplay: '1931',
        medium: 'Oil on canvas',
        origin: 'Spain',
      },
      startingPrice: 500000,
      minIncrement: 50000,
      currentPrice: 0,
      startsAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      status: LotStatus.CANCELLED,
    },
  });

  // =========================================================================
  // 7. SINCRONIZAÇÃO AUTOMÁTICA DOS SALDOS COMPROMETIDOS DOS LÍDERES ATUAIS
  // =========================================================================
  const activeLots = await prisma.lot.findMany({
    where: { status: LotStatus.ACTIVE, winnerId: { not: null } },
  });

  for (const lot of activeLots) {
    if (lot.winnerId && lot.currentPrice > 0) {
      await prisma.user.update({
        where: { id: lot.winnerId },
        data: {
          committedBalance: { increment: lot.currentPrice },
        },
      });
    }
  }

  console.log('✅ Seed completo! Plataforma populada com sucesso.');
  console.log('------------------------------------------------------------');
  console.log('📊 RESUMO DO CENÁRIO CRIADO:');
  console.log('• 2 Leiloeiros | 5 Licitantes com carteiras ativas');
  console.log('• 4 Lotes AO VIVO (18 lances encadeados com HMAC-SHA256)');
  console.log('• 3 Lotes AGENDADOS');
  console.log('• 2 Lotes ENCERRADOS (1 com Comprovante Oficial emitido)');
  console.log('• 1 Lote CANCELADO (Oculto da vitrine pública)');
  console.log('------------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });