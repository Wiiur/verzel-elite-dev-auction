'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, formatCurrency } from '@/services/api';
import { Search, Flame, Calendar, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface LotItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
  minIncrement: number;
  currentPrice: number;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'UNSOLD' | 'CANCELLED';
  auctioneer: { name: string; publicAlias: string };
  winner?: { publicAlias: string } | null;
  _count: { bids: number };
}

export default function ShowcasePage() {
  const [lots, setLots] = useState<LotItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'SCHEDULED' | 'ENDED'>('ACTIVE');
  const [loading, setLoading] = useState(true);

  const fetchLots = async (searchTerm = search) => {
    try {
      const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const data = await apiFetch<LotItem[]>(`/lots${query}`);
      setLots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
    const interval = setInterval(() => fetchLots(), 5000);
    return () => clearInterval(interval);
  }, [search]);

  const filteredLots = lots.filter((lot) => {
    if (lot.status === 'CANCELLED') return false;
    if (activeTab === 'ACTIVE') return lot.status === 'ACTIVE';
    if (activeTab === 'SCHEDULED') return lot.status === 'SCHEDULED';
    return lot.status === 'FINISHED' || lot.status === 'UNSOLD';
  });

  return (
    <div className="space-y-8">
      {/* Banner e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Vitrine de Leilões de Arte
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Dispute obras catalogadas em tempo real com liquidação instantânea e auditoria criptográfica pública.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar obra ou artista..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Abas: Ao Vivo, Agendados, Encerrados */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'ACTIVE'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-200/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" />
          Ao Vivo ({lots.filter((l) => l.status === 'ACTIVE').length})
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULED')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'SCHEDULED'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-200/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Agendados ({lots.filter((l) => l.status === 'SCHEDULED').length})
        </button>

        <button
          onClick={() => setActiveTab('ENDED')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'ENDED'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-200/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Encerrados ({lots.filter((l) => l.status === 'FINISHED' || l.status === 'UNSOLD').length})
        </button>
      </div>

      {/* Grid de Lotes */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Carregando vitrine de lotes...</div>
      ) : filteredLots.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
          <p className="text-slate-500">Nenhum lote encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLots.map((lot) => (
            <div
              key={lot.id}
              className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-sm"
            >
              <div>
                <div className="relative h-56 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={lot.imageUrl}
                    alt={lot.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    {lot.status === 'ACTIVE' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 flex items-center gap-1.5 shadow">
                        <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                        AO VIVO
                      </span>
                    )}
                    {lot.status === 'SCHEDULED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500 text-slate-950 shadow">
                        AGENDADO
                      </span>
                    )}
                    {(lot.status === 'FINISHED' || lot.status === 'UNSOLD') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-white shadow">
                        {lot.status === 'FINISHED' ? 'ARREMATADO' : 'SEM LANCES'}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-slate-950/80 text-white text-xs font-mono">
                    {lot._count.bids} lance(s)
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <h2 className="font-bold text-lg line-clamp-1">{lot.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {lot.description}
                  </p>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                        {lot.currentPrice > 0 ? 'Lance Atual' : 'Lance Inicial'}
                      </span>
                      <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                        {formatCurrency(lot.currentPrice > 0 ? lot.currentPrice : lot.startingPrice)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                        Incremento Mín.
                      </span>
                      <span className="text-sm font-semibold">
                        + {formatCurrency(lot.minIncrement)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <Link
                  href={`/audit/${lot.id}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-amber-500 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Auditar Hashes
                </Link>

                <Link
                  href={`/lots/${lot.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition"
                >
                  {lot.status === 'ACTIVE' ? 'Entrar na Sala Ao Vivo' : 'Ver Detalhes'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}