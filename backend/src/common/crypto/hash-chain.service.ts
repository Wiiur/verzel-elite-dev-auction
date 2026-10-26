import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface BidHashPayload {
  lotId: string;
  sequenceNumber: number;
  bidderId: string;
  amount: number;
  createdAtIso: string;
  previousHash: string;
}

@Injectable()
export class HashChainService {
  private readonly secret = process.env.AUDIT_HMAC_SECRET || 'default-secret';

  /**
   * Gera o hash inicial (Genesis) único para cada lote.
   */
  getGenesisHash(lotId: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`GENESIS:${lotId}`)
      .digest('hex');
  }

  /**
   * Calcula o HMAC-SHA256 de um lance encadeado ao hash anterior.
   */
  calculateBidHash(payload: BidHashPayload): string {
    const rawData = [
      payload.lotId,
      payload.sequenceNumber.toString(),
      payload.bidderId,
      payload.amount.toString(),
      payload.createdAtIso,
      payload.previousHash,
    ].join('|');

    return crypto
      .createHmac('sha256', this.secret)
      .update(rawData)
      .digest('hex');
  }

  /**
   * Audita a lista de lances vinda da base de dados e deteta adulterações,
   * exclusões de registos intermédios ou inserções forjadas.
   */
  verifyLotHistory(
    lotId: string,
    bids: Array<{
      id: string;
      sequenceNumber: number;
      bidderId: string;
      publicAlias: string;
      amount: number;
      createdAt: Date;
      previousHash: string;
      bidHash: string;
    }>,
  ) {
    let expectedPreviousHash = this.getGenesisHash(lotId);
    let expectedSequence = 1;
    let isTampered = false;
    const issues: string[] = [];

    const auditedBids = bids.map((bid) => {
      let bidValid = true;

      // 1. Verifica se algum lance foi apagado (quebra na sequência 1, 2, 3...)
      if (bid.sequenceNumber !== expectedSequence) {
        bidValid = false;
        isTampered = true;
        issues.push(
          `Quebra de sequência detetada no lance #${bid.sequenceNumber} (esperado #${expectedSequence}). Registos foram removidos ou inseridos.`,
        );
      }

      // 2. Verifica se o elo com o lance anterior foi quebrado
      if (bid.previousHash !== expectedPreviousHash) {
        bidValid = false;
        isTampered = true;
        issues.push(
          `Elo criptográfico (previousHash) inválido no lance #${bid.sequenceNumber}.`,
        );
      }

      // 3. Recalcula o hash com os dados atuais da linha na base de dados
      const recalculatedHash = this.calculateBidHash({
        lotId,
        sequenceNumber: bid.sequenceNumber,
        bidderId: bid.bidderId,
        amount: bid.amount,
        createdAtIso: bid.createdAt.toISOString(),
        previousHash: bid.previousHash,
      });

      if (recalculatedHash !== bid.bidHash) {
        bidValid = false;
        isTampered = true;
        issues.push(
          `Assinatura criptográfica inválida no lance #${bid.sequenceNumber}. O valor, autor ou horário foi adulterado diretamente na base de dados.`,
        );
      }

      expectedPreviousHash = bid.bidHash;
      expectedSequence = bid.sequenceNumber + 1;

      return {
        sequenceNumber: bid.sequenceNumber,
        bidderAlias: bid.publicAlias, // Preserva a privacidade do licitante
        amount: bid.amount,
        createdAt: bid.createdAt,
        previousHash: bid.previousHash,
        storedHash: bid.bidHash,
        recalculatedHash,
        isValid: bidValid,
      };
    });

    return {
      lotId,
      isIntact: !isTampered,
      status: isTampered ? 'TAMPERED' : 'VERIFIED_INTACT',
      totalBids: bids.length,
      issues,
      auditTrail: auditedBids,
    };
  }
}