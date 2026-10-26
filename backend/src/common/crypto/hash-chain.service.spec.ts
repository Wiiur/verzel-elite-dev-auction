import { HashChainService } from './hash-chain.service';

describe('HashChainService (Auditoria Anti-Adulteração)', () => {
  let service: HashChainService;
  const lotId = 'lot-123';

  beforeEach(() => {
    process.env.AUDIT_HMAC_SECRET = 'test-secret-key';
    service = new HashChainService();
  });

  it('deve validar um histórico de lances 100% íntegro', () => {
    const genesis = service.getGenesisHash(lotId);
    const t1 = new Date('2026-10-23T10:00:00.000Z');
    const h1 = service.calculateBidHash({
      lotId,
      sequenceNumber: 1,
      bidderId: 'user-1',
      amount: 10000,
      createdAtIso: t1.toISOString(),
      previousHash: genesis,
    });

    const t2 = new Date('2026-10-23T10:05:00.000Z');
    const h2 = service.calculateBidHash({
      lotId,
      sequenceNumber: 2,
      bidderId: 'user-2',
      amount: 15000,
      createdAtIso: t2.toISOString(),
      previousHash: h1,
    });

    const result = service.verifyLotHistory(lotId, [
      {
        id: 'b1',
        sequenceNumber: 1,
        bidderId: 'user-1',
        publicAlias: 'Licitante #01',
        amount: 10000,
        createdAt: t1,
        previousHash: genesis,
        bidHash: h1,
      },
      {
        id: 'b2',
        sequenceNumber: 2,
        bidderId: 'user-2',
        publicAlias: 'Licitante #02',
        amount: 15000,
        createdAt: t2,
        previousHash: h1,
        bidHash: h2,
      },
    ]);

    expect(result.isIntact).toBe(true);
    expect(result.status).toBe('VERIFIED_INTACT');
    expect(result.issues).toHaveLength(0);
  });

  it('deve detectar adulteração direta de valor no banco de dados', () => {
    const genesis = service.getGenesisHash(lotId);
    const t1 = new Date('2026-10-23T10:00:00.000Z');
    const h1 = service.calculateBidHash({
      lotId,
      sequenceNumber: 1,
      bidderId: 'user-1',
      amount: 10000,
      createdAtIso: t1.toISOString(),
      previousHash: genesis,
    });

    // Simula alguém alterando o valor no banco de 10000 para 50000 sem recalcular o HMAC
    const result = service.verifyLotHistory(lotId, [
      {
        id: 'b1',
        sequenceNumber: 1,
        bidderId: 'user-1',
        publicAlias: 'Licitante #01',
        amount: 50000, // Valor adulterado!
        createdAt: t1,
        previousHash: genesis,
        bidHash: h1,
      },
    ]);

    expect(result.isIntact).toBe(false);
    expect(result.status).toBe('TAMPERED');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('deve detectar exclusão de um lance intermediário na sequência', () => {
    const genesis = service.getGenesisHash(lotId);
    const t2 = new Date('2026-10-23T10:05:00.000Z');

    // Simula que o lance #1 foi deletado do banco, começando direto no #2
    const result = service.verifyLotHistory(lotId, [
      {
        id: 'b2',
        sequenceNumber: 2,
        bidderId: 'user-2',
        publicAlias: 'Licitante #02',
        amount: 15000,
        createdAt: t2,
        previousHash: genesis,
        bidHash: 'hash-qualquer',
      },
    ]);

    expect(result.isIntact).toBe(false);
    expect(result.status).toBe('TAMPERED');
  });
});