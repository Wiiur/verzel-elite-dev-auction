'use client';

import { useEffect, useState, useCallback, use, Suspense } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { apiFetch, formatCurrency, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Clock,
  Gavel,
  ShieldCheck,
  Trophy,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Receipt,
} from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

interface LotRoomBid {
  id: string;
  sequenceNumber: number;
  amount: number;
  createdAt: string;
  bidderId: string;
  bidderAlias: string;
}

interface LotRoomDetails {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  startingPrice: number;
  minIncrement: number;
  currentPrice: number;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'UNSOLD' | 'CANCELLED';
  winnerId?: string | null;
  attributesJson?: Record<string, string | number>;
  auctioneer?: { id: string; publicAlias: string };
  receipt?: { id: string } | null;
  bids: LotRoomBid[];
}

interface WsBidPayload {
  bidId: string;
  sequenceNumber: number;
  amount: number;
  bidderAlias: string;
  leaderId: string;
  previousLeaderId: string | null;
  endsAt: string;
  wasExtended: boolean;
  createdAt: string;
}

function LiveLotRoomContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: lotId } = use(params);
  const { user, refreshProfile } = useAuth();

  const [lot, setLot] = useState<LotRoomDetails | null>(null);
  const [bidAmountReais, setBidAmountReais] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [wasOutbidAlert, setWasOutbidAlert] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadLot = useCallback(async () => {
    try {
      const data = await apiFetch<LotRoomDetails>(`/lots/${lotId}`);
      setLot(data);
      const nextMinCents =
        data.currentPrice > 0
          ? data.currentPrice + data.minIncrement
          : data.startingPrice;
      setBidAmountReais((nextMinCents / 100).toFixed(2));
    } catch (err: unknown) {
      setFeedbackError(getErrorMessage(err));
    }
  }, [lotId]);

  useEffect(() => {
    let active = true;
    apiFetch<LotRoomDetails>(`/lots/${lotId}`)
      .then((data) => {
        if (!active) return;
        setLot(data);
        const nextMinCents =
          data.currentPrice > 0
            ? data.currentPrice + data.minIncrement
            : data.startingPrice;
        setBidAmountReais((nextMinCents / 100).toFixed(2));
      })
      .catch((err: unknown) => {
        if (active) setFeedbackError(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, [lotId]);

  useEffect(() => {
    const socket: Socket = io(WS_URL);

    socket.emit('join_lot', { lotId });

    socket.on('bid_placed', (payload: WsBidPayload) => {
      setLot((prev) => {
        if (!prev) return prev;
        const newBidItem: LotRoomBid = {
          id: payload.bidId,
          sequenceNumber: payload.sequenceNumber,
          amount: payload.amount,
          createdAt: payload.createdAt,
          bidderId: payload.leaderId,
          bidderAlias: payload.bidderAlias,
        };
        const nextMinCents = payload.amount + prev.minIncrement;
        setBidAmountReais((nextMinCents / 100).toFixed(2));

        return {
          ...prev,
          currentPrice: payload.amount,
          winnerId: payload.leaderId,
          endsAt: payload.endsAt,
          bids: [newBidItem, ...prev.bids],
        };
      });

      if (user && payload.previousLeaderId === user.id && payload.leaderId !== user.id) {
        setWasOutbidAlert(true);
      } else if (user && payload.leaderId === user.id) {
        setWasOutbidAlert(false);
      }

      refreshProfile();
    });

    socket.on('lot_status_changed', () => {
      loadLot();
      refreshProfile();
    });

    return () => {
      socket.emit('leave_lot', { lotId });
      socket.disconnect();
    };
  }, [lotId, user, refreshProfile, loadLot]);

  useEffect(() => {
    if (!lot) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target =
        lot.status === 'SCHEDULED'
          ? new Date(lot.startsAt).getTime()
          : new Date(lot.endsAt).getTime();

      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        if (lot.status === 'ACTIVE' || lot.status === 'SCHEDULED') {
          loadLot();
        }
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [lot, loadLot]);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');

    const cents = Math.round(parseFloat(bidAmountReais.replace(',', '.')) * 100);
    if (isNaN(cents) || cents <= 0) {
      setFeedbackError('Informe um valor válido para o lance.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/lots/${lotId}/bids`, {
        method: 'POST',
        body: JSON.stringify({ amountInCents: cents }),
      });
      setFeedbackSuccess('Lance registrado com sucesso! Você assumiu a liderança.');
      setWasOutbidAlert(false);
      await refreshProfile();
    } catch (err: unknown) {
      setFeedbackError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!lot) {
    return <div className="py-16 text-center text-slate-500">Carregando sala do lote...</div>;
  }

  const isUserLeading = Boolean(user && lot.winnerId === user.id);
  const hasUserParticipated = Boolean(
    user && lot.bids.some((b) => b.bidderId === user.id),
  );
  const isUserOutbid = hasUserParticipated && !isUserLeading;
  const minimumNextBidCents =
    lot.currentPrice > 0 ? lot.currentPrice + lot.minIncrement : lot.startingPrice;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="relative h-96 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            <img
              src={lot.imageUrl}
              alt={lot.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src =
                  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1000&q=80';
              }}
              className="w-full h-80 object-cover rounded-2xl border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                Leiloeiro Responsável: {lot.auctioneer?.publicAlias}
              </span>
              <Link
                href={`/audit/${lot.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500/20 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                Auditar Integridade Criptográfica (Público)
              </Link>
            </div>

            <h1 className="text-2xl font-extrabold">{lot.title}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{lot.description}</p>

            {lot.attributesJson && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                {Object.entries(lot.attributesJson).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <span className="uppercase text-[10px] text-slate-400 block">{key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 block">
                {lot.status === 'SCHEDULED' ? 'Inicia em' : 'Tempo Restante'}
              </span>
              <div className="flex items-center gap-2 text-2xl font-mono font-extrabold text-amber-500">
                <Clock className="w-5 h-5" />
                <span>
                  {lot.status === 'ACTIVE' || lot.status === 'SCHEDULED'
                    ? timeLeft
                    : 'ENCERRADO'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-slate-400 block">
                {lot.currentPrice > 0 ? 'Lance Líder Atual' : 'Lance Inicial'}
              </span>
              <span className="text-3xl font-extrabold text-emerald-500">
                {formatCurrency(lot.currentPrice > 0 ? lot.currentPrice : lot.startingPrice)}
              </span>
            </div>
          </div>

          {user && user.role === 'BIDDER' && (
            <div>
              {isUserLeading && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 flex items-center gap-3 font-bold text-sm">
                  <Trophy className="w-5 h-5 shrink-0" />
                  <span>
                    {lot.status === 'FINISHED'
                      ? 'Parabéns! Você arrematou este lote!'
                      : 'Você está ganhando! (1º Lugar no lote)'}
                  </span>
                </div>
              )}

              {(isUserOutbid || wasOutbidAlert) && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-500 flex items-center gap-3 font-bold text-sm animate-pulse">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>
                    Você foi superado! Seu saldo comprometido já foi liberado na carteira.
                  </span>
                </div>
              )}
            </div>
          )}

          {lot.status === 'FINISHED' && lot.receipt && (
            <Link
              href={`/receipts/${lot.receipt.id}`}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <Receipt className="w-4 h-4" />
              Ver Comprovante Oficial de Arremate
            </Link>
          )}

          {lot.status === 'ACTIVE' && (
            <form
              onSubmit={handlePlaceBid}
              className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="flex justify-between text-xs text-slate-400">
                <span>Próximo lance mínimo: {formatCurrency(minimumNextBidCents)}</span>
                <span>Incremento: +{formatCurrency(lot.minIncrement)}</span>
              </div>

              {feedbackError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                  {feedbackError}
                </div>
              )}

              {feedbackSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {feedbackSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={bidAmountReais}
                    onChange={(e) => setBidAmountReais(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-bold text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !user}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center gap-2 transition"
                >
                  <Gavel className="w-4 h-4" />
                  {submitting ? 'Enviando...' : 'Dar Lance'}
                </button>
              </div>

              {!user && (
                <p className="text-xs text-center text-slate-400">
                  Faça{' '}
                  <Link href="/login" className="text-amber-500 underline">
                    login como Licitante
                  </Link>{' '}
                  para disputar este lote.
                </p>
              )}
            </form>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Histórico de Lances ({lot.bids.length})
            </h2>
            <span className="text-[11px] text-slate-400">Tempo real via WebSocket</span>
          </div>

          {lot.bids.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhum lance registrado ainda. Seja o primeiro!
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {lot.bids.map((bid, index) => {
                const isMine = user && bid.bidderId === user.id;
                return (
                  <div
                    key={bid.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      index === 0
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-500">
                          #{bid.sequenceNumber}
                        </span>
                        <span className="font-semibold">
                          {bid.bidderAlias} {isMine && '(Você)'}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px]">
                            LÍDER
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(bid.createdAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>

                    <span className="text-sm font-extrabold">
                      {formatCurrency(bid.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveLotRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-16 text-center text-slate-500">Carregando sala do lote...</div>}>
      <LiveLotRoomContent params={params} />
    </Suspense>
  );
}