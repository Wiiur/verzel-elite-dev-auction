'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, formatCurrency, getErrorMessage } from '@/services/api';
import { Search, PlusCircle, XCircle, DollarSign, Package } from 'lucide-react';

interface CatalogItem {
  externalId: string;
  title: string;
  description: string;
  imageUrl: string;
  attributes: {
    artist: string;
    dateDisplay: string;
    medium: string;
    origin: string;
  };
}

interface AuctioneerLot {
  id: string;
  title: string;
  status: string;
  startingPrice: number;
  currentPrice: number;
  winner?: { publicAlias: string } | null;
  _count: { bids: number };
}

interface AuctioneerDashboard {
  totalReceivedInCents: number;
  totalLots: number;
  lots: AuctioneerLot[];
}

export default function AuctioneerDashboardPage() {
  const [dashboard, setDashboard] = useState<AuctioneerDashboard | null>(null);
  const [apiQuery, setApiQuery] = useState('impressionism');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const [startingReais, setStartingReais] = useState('1000');
  const [incrementReais, setIncrementReais] = useState('200');
  const [startsInMinutes, setStartsInMinutes] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiFetch<AuctioneerDashboard>('/lots/auctioneer/my-lots');
      setDashboard(data);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  }, []);

  const searchCatalog = useCallback(async (queryToSearch: string) => {
    try {
      const items = await apiFetch<CatalogItem[]>(
        `/catalog/search?q=${encodeURIComponent(queryToSearch)}`,
      );
      setCatalogItems(items);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<AuctioneerDashboard>('/lots/auctioneer/my-lots'),
      apiFetch<CatalogItem[]>('/catalog/search?q=impressionism'),
    ])
      .then(([dashData, catData]) => {
        if (!active) return;
        setDashboard(dashData);
        setCatalogItems(catData);
      })
      .catch((err: unknown) => {
        if (active) setMessage(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setMessage('');

    const now = new Date();
    const startsAt = new Date(now.getTime() + Number(startsInMinutes) * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + Number(durationMinutes) * 60 * 1000);

    try {
      await apiFetch('/lots', {
        method: 'POST',
        body: JSON.stringify({
          externalItemId: selectedItem.externalId,
          title: selectedItem.title,
          description: selectedItem.description,
          imageUrl: selectedItem.imageUrl,
          attributesJson: selectedItem.attributes,
          startingPriceInCents: Math.round(Number(startingReais) * 100),
          minIncrementInCents: Math.round(Number(incrementReais) * 100),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      setSelectedItem(null);
      setMessage('Lote publicado com sucesso!');
      await loadDashboard();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  };

  const handleCancelLot = async (lotId: string) => {
    try {
      await apiFetch(`/lots/${lotId}/cancel`, { method: 'PATCH' });
      setMessage('Lote cancelado e saldos comprometidos estornados.');
      await loadDashboard();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Painel do Leiloeiro</h1>
          <p className="text-xs text-slate-400">
            Importe obras da API pública, configure lotes e acompanhe a liquidação financeira.
          </p>
        </div>

        {dashboard && (
          <div className="flex gap-4">
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[11px] uppercase text-slate-400 block">Total Recebido</span>
              <span className="text-xl font-extrabold text-emerald-400 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {formatCurrency(dashboard.totalReceivedInCents)}
              </span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white">
              <span className="text-[11px] uppercase text-slate-400 block">Lotes Criados</span>
              <span className="text-xl font-extrabold flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-500" />
                {dashboard.totalLots}
              </span>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold">
          {message}
        </div>
      )}

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-bold text-base">1. Buscar Item na API Pública (Art Institute of Chicago)</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiQuery}
            onChange={(e) => setApiQuery(e.target.value)}
            placeholder="Ex: van gogh, monet, samurai, sculpture..."
            className="flex-1 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-transparent text-sm"
          />
          <button
            onClick={() => searchCatalog(apiQuery)}
            className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" /> Buscar na API
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2 max-h-80 overflow-y-auto">
          {catalogItems.map((item) => (
            <div
              key={item.externalId}
              onClick={() => setSelectedItem(item)}
              className={`cursor-pointer p-3 rounded-xl border transition ${
                selectedItem?.externalId === item.externalId
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80';
                }}
                className="w-full h-28 object-cover rounded-lg mb-2"
              />
              <p className="font-bold text-xs line-clamp-1">{item.title}</p>
              <p className="text-[11px] text-slate-400 line-clamp-1">{item.attributes.artist}</p>
            </div>
          ))}
        </div>

        {selectedItem && (
          <form
            onSubmit={handleCreateLot}
            className="p-4 mt-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-500/40 space-y-4"
          >
            <h3 className="font-bold text-sm text-amber-500">
              Configurar Novo Lote: {selectedItem.title}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block mb-1">Lance Inicial (R$)</label>
                <input
                  type="number"
                  required
                  value={startingReais}
                  onChange={(e) => setStartingReais(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block mb-1">Incremento Mín. (R$)</label>
                <input
                  type="number"
                  required
                  value={incrementReais}
                  onChange={(e) => setIncrementReais(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block mb-1">Inicia em (minutos)</label>
                <input
                  type="number"
                  required
                  value={startsInMinutes}
                  onChange={(e) => setStartsInMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block mb-1">Duração (minutos)</label>
                <input
                  type="number"
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Publicar Lote Agora
            </button>
          </form>
        )}
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-bold text-base">2. Meus Lotes e Resultado de Arremates</h2>
        <div className="space-y-3">
          {dashboard?.lots?.map((lot) => (
            <div
              key={lot.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400">
                    {lot.status}
                  </span>
                  <h3 className="font-bold text-sm">{lot.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Lances: {lot._count.bids} | Valor Atual/Final:{' '}
                  <strong className="text-emerald-500">
                    {formatCurrency(lot.currentPrice || lot.startingPrice)}
                  </strong>{' '}
                  {lot.winner && `| Vencedor: ${lot.winner.publicAlias}`}
                </p>
              </div>

              {(lot.status === 'ACTIVE' || lot.status === 'SCHEDULED') && (
                <button
                  onClick={() => handleCancelLot(lot.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-1 self-start sm:self-center"
                >
                  <XCircle className="w-4 h-4" /> Cancelar Lote (com Estorno)
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}