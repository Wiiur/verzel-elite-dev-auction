'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, formatCurrency } from '@/services/api';
import { Trophy, ExternalLink, Receipt } from 'lucide-react';

interface MyAuctionItem {
  lotId: string;
  title: string;
  status: string;
  currentPrice: number;
  myHighestBid: number;
  receipt?: { id: string } | null;
}

export default function MyAuctionsPage() {
  const [items, setItems] = useState<MyAuctionItem[]>([]);

  useEffect(() => {
    apiFetch<MyAuctionItem[]>('/wallet/my-auctions')
      .then(setItems)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold flex items-center gap-2">
        <Trophy className="w-6 h-6 text-amber-500" />
        Meus Lances e Arremates
      </h1>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Você ainda não deu lances em nenhum lote.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.lotId}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4"
            >
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                  {item.status}
                </span>
                <h2 className="font-bold text-base mt-2">{item.title}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Meu maior lance: <strong>{formatCurrency(item.myHighestBid)}</strong> | Lance
                  atual/final: <strong>{formatCurrency(item.currentPrice)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <Link
                  href={`/lots/${item.lotId}`}
                  className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1"
                >
                  Abrir Sala do Lote <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                {item.receipt && (
                  <Link
                    href={`/receipts/${item.receipt.id}`}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" /> Comprovante Compartilhável
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}